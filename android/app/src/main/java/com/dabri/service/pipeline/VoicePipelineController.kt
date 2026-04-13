package com.dabri.service.pipeline

import android.content.Context
import android.util.Log
import com.dabri.service.PipelineState
import com.dabri.service.audio.AudioFocusManager
import com.dabri.service.audio.SpeechRecognizerManager
import com.dabri.service.audio.TextToSpeechManager
import com.dabri.service.config.ServicePreferences
import kotlinx.coroutines.*

class VoicePipelineController(
    private val context: Context,
    private val preferences: ServicePreferences,
    private val onStateChanged: (PipelineState, String?) -> Unit
) {
    companion object {
        private const val TAG = "VoicePipeline"
    }

    var state: PipelineState = PipelineState.IDLE
        private set

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val parser = GeminiIntentParser()
    private val contactResolver = ContactResolverNative(context)
    private val appResolver = AppNameResolverNative(context)
    private val dispatcher = NativeActionDispatcher(
        context, preferences, contactResolver, appResolver, HebrewTimeParserNative
    )

    private var sttManager: SpeechRecognizerManager? = null
    private var ttsManager: TextToSpeechManager? = null
    private var audioFocusManager: AudioFocusManager? = null
    private var currentTranscript = ""

    init {
        try {
            audioFocusManager = AudioFocusManager(context)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to init audio focus", e)
        }
        try {
            ttsManager = TextToSpeechManager(
                context,
                onDone = { onTtsDone() },
                onError = { error ->
                    Log.e(TAG, "TTS error: $error")
                    onTtsDone()
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to init TTS", e)
        }
    }

    fun onWakeWordDetected() {
        startRecognition()
    }

    fun onBubbleTapped() {
        when (state) {
            PipelineState.SPEAKING -> {
                ttsManager?.stop()
                transition(PipelineState.IDLE, null)
            }
            PipelineState.IDLE, PipelineState.DEGRADED -> {
                startRecognition()
            }
            else -> {}
        }
    }

    fun finishRecognizing() {
        if (state == PipelineState.RECOGNIZING) {
            sttManager?.stop()
        }
    }

    fun cancel() {
        sttManager?.destroy()
        sttManager = null
        ttsManager?.stop()
        audioFocusManager?.abandonFocus()
        transition(PipelineState.IDLE, null)
    }

    private fun startRecognition() {
        Log.d(TAG, "Starting recognition")
        currentTranscript = ""

        // Request audio focus
        audioFocusManager?.requestFocus(
            onLoss = {
                Log.w(TAG, "Audio focus lost during recognition")
                sttManager?.stop()
            },
            onGain = { }
        )

        transition(PipelineState.RECOGNIZING, null)

        sttManager = SpeechRecognizerManager(
            context = context,
            locale = "he-IL",
            maxListeningMs = 15000,
            onPartialResult = { text ->
                currentTranscript = text
                transition(PipelineState.RECOGNIZING, text)
            },
            onFinalResult = { text ->
                currentTranscript = text
                onRecognitionComplete(text)
            },
            onError = { error ->
                Log.e(TAG, "STT error: $error")
                transition(PipelineState.ERROR, error)
                scope.launch {
                    delay(2000)
                    cancel()
                }
            }
        )
        sttManager?.start()
    }

    private fun onRecognitionComplete(text: String) {
        sttManager?.destroy()
        sttManager = null

        if (text.isBlank()) {
            Log.d(TAG, "Empty recognition result")
            transition(PipelineState.IDLE, null)
            audioFocusManager?.abandonFocus()
            return
        }

        Log.d(TAG, "Recognition complete: $text")
        transition(PipelineState.PARSING, text)

        scope.launch {
            try {
                val intent = parser.parse(text, preferences.geminiApiKey)
                Log.d(TAG, "Parsed intent: ${intent.intent} (${intent.source})")

                transition(PipelineState.EXECUTING, text)
                val result = dispatcher.dispatch(intent)

                // Update TTS rate
                ttsManager?.rate = preferences.ttsSpeed

                // Speak result
                transition(PipelineState.SPEAKING, result.message)
                if (ttsManager != null) {
                    ttsManager?.speak(result.message)
                } else {
                    onTtsDone()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Pipeline error", e)
                transition(PipelineState.SPEAKING, "אירעה שגיאה. נסה שוב.")
                if (ttsManager != null) {
                    ttsManager?.speak("אירעה שגיאה. נסה שוב.")
                } else {
                    onTtsDone()
                }
            }
        }
    }

    private fun onTtsDone() {
        audioFocusManager?.abandonFocus()
        transition(PipelineState.IDLE, null)
    }

    private fun transition(newState: PipelineState, transcript: String?) {
        state = newState
        onStateChanged(newState, transcript)
    }

    fun destroy() {
        scope.cancel()
        sttManager?.destroy()
        ttsManager?.destroy()
        audioFocusManager?.abandonFocus()
    }
}
