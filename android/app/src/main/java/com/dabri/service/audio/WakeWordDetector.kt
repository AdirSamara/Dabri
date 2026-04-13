package com.dabri.service.audio

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import java.util.Locale

class WakeWordDetector(
    private val context: Context,
    private val sensitivity: Float = 0.5f,
    private val onWakeWordDetected: () -> Unit,
    private val onError: (String) -> Unit
) {
    companion object {
        private const val TAG = "WakeWordDetector"
        private const val RESTART_DELAY_MS = 1000L
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var speechRecognizer: SpeechRecognizer? = null
    private var isRunning = false
    private var isListening = false

    /**
     * Wake phrases checked against partial/final results.
     * Sensitivity controls how loosely we match:
     *   low  (< 0.4)  -> exact "היי דברי" only
     *   med  (0.4-0.6) -> also "הי דברי", "דברי"
     *   high (> 0.6)   -> also partial substring matches
     */
    private val exactPhrases = listOf("היי דברי", "הי דברי", "hi dabri", "hey dabri")
    private val loosePhrases = listOf("דברי")

    fun start() {
        if (isRunning) return
        isRunning = true
        Log.d(TAG, "Wake word detection starting (sensitivity=$sensitivity)")
        mainHandler.post { startListeningInternal() }
    }

    fun stop() {
        if (!isRunning) return
        isRunning = false
        Log.d(TAG, "Wake word detection stopping")
        mainHandler.post { stopListeningInternal() }
    }

    fun destroy() {
        isRunning = false
        mainHandler.removeCallbacksAndMessages(null)
        mainHandler.post {
            stopListeningInternal()
            speechRecognizer?.destroy()
            speechRecognizer = null
            Log.d(TAG, "WakeWordDetector destroyed")
        }
    }

    // ---- internal (always called on main thread) ----

    private fun startListeningInternal() {
        if (!isRunning) return
        if (isListening) return

        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            Log.e(TAG, "SpeechRecognizer not available on this device")
            onError("Speech recognition not available")
            return
        }

        try {
            if (speechRecognizer == null) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).also {
                    it.setRecognitionListener(wakeListener)
                }
            }

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "he-IL")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "he-IL")
                putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "he-IL")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                // Keep listening as long as possible
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 10000)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000)
            }

            speechRecognizer?.startListening(intent)
            isListening = true
            Log.d(TAG, "SpeechRecognizer listening started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start SpeechRecognizer", e)
            isListening = false
            scheduleRestart()
        }
    }

    private fun stopListeningInternal() {
        isListening = false
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.cancel()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping SpeechRecognizer", e)
        }
    }

    private fun scheduleRestart() {
        if (!isRunning) return
        isListening = false
        // Recreate recognizer to avoid stale state
        try {
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        speechRecognizer = null
        Log.d(TAG, "Scheduling restart in ${RESTART_DELAY_MS}ms")
        mainHandler.postDelayed({ startListeningInternal() }, RESTART_DELAY_MS)
    }

    private fun containsWakeWord(text: String): Boolean {
        val lower = text.lowercase(Locale.ROOT).trim()
        if (lower.isBlank()) return false

        // Low sensitivity: exact phrases only
        for (phrase in exactPhrases) {
            if (lower.contains(phrase.lowercase(Locale.ROOT))) return true
        }

        // Medium sensitivity: also loose phrases
        if (sensitivity >= 0.4f) {
            for (phrase in loosePhrases) {
                if (lower.contains(phrase.lowercase(Locale.ROOT))) return true
            }
        }

        // High sensitivity: substring match on "דבר" (root)
        if (sensitivity > 0.6f) {
            if (lower.contains("דבר") || lower.contains("dabri") || lower.contains("dabr")) {
                return true
            }
        }

        return false
    }

    private val wakeListener = object : RecognitionListener {

        override fun onReadyForSpeech(params: Bundle?) {
            Log.d(TAG, "Ready for speech")
        }

        override fun onBeginningOfSpeech() {
            Log.d(TAG, "Speech begun")
        }

        override fun onRmsChanged(rmsdB: Float) {
            // no-op; could use for UI level meter
        }

        override fun onBufferReceived(buffer: ByteArray?) {}

        override fun onEndOfSpeech() {
            Log.d(TAG, "End of speech")
            isListening = false
        }

        override fun onError(error: Int) {
            isListening = false
            when (error) {
                SpeechRecognizer.ERROR_NO_MATCH,
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                    // Normal: no one spoke or silence detected. Just restart.
                    Log.d(TAG, "No match / timeout (error=$error), restarting")
                    scheduleRestart()
                }
                SpeechRecognizer.ERROR_CLIENT -> {
                    Log.w(TAG, "Client error, restarting")
                    scheduleRestart()
                }
                else -> {
                    val msg = "SpeechRecognizer error code=$error"
                    Log.e(TAG, msg)
                    this@WakeWordDetector.onError(msg)
                    // Still try to restart
                    scheduleRestart()
                }
            }
        }

        override fun onResults(results: Bundle?) {
            isListening = false
            val texts = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            Log.d(TAG, "Final results: $texts")
            texts?.forEach { text ->
                if (containsWakeWord(text)) {
                    Log.d(TAG, "Wake word detected in final result: \"$text\"")
                    onWakeWordDetected()
                    return
                }
            }
            // No wake word in final results, keep listening
            scheduleRestart()
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val texts = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            Log.d(TAG, "Partial results: $texts")
            texts?.forEach { text ->
                if (containsWakeWord(text)) {
                    Log.d(TAG, "Wake word detected in partial result: \"$text\"")
                    // Stop current session before firing callback
                    stopListeningInternal()
                    onWakeWordDetected()
                    return
                }
            }
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }
}
