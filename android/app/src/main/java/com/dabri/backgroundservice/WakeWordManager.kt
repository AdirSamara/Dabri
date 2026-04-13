package com.dabri.backgroundservice

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Continuous wake word detection using Android's SpeechRecognizer.
 *
 * Uses AudioManager to briefly claim audio focus before startListening()
 * to suppress the system beep, then abandons focus so TTS can work.
 */
class WakeWordManager(
    private val context: Context,
    private val onWakeWordDetected: (remainingText: String) -> Unit
) {
    private var recognizer: SpeechRecognizer? = null
    private var isActive = false
    private var wakePhrase = "היי דברי"
    private var matchVariants: List<String> = getMatchVariants(wakePhrase)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var audioFocusRequest: AudioManager.OnAudioFocusChangeListener? = null

    companion object {
        private const val RELISTEN_DELAY_MS = 500L
        private const val ERROR_RELISTEN_DELAY_MS = 2000L
        private const val BUSY_RELISTEN_DELAY_MS = 3000L
    }

    fun start(phrase: String) {
        stop()

        wakePhrase = phrase
        matchVariants = getMatchVariants(phrase)
        isActive = true

        mainHandler.post {
            try {
                recognizer = SpeechRecognizer.createSpeechRecognizer(context)
                recognizer?.setRecognitionListener(createListener())
                beginListening()
            } catch (_: Exception) {
                mainHandler.postDelayed({ if (isActive) start(phrase) }, BUSY_RELISTEN_DELAY_MS)
            }
        }
    }

    fun stop() {
        isActive = false
        mainHandler.removeCallbacksAndMessages(null)
        abandonAudioFocus()
        try {
            recognizer?.stopListening()
            recognizer?.cancel()
            recognizer?.destroy()
        } catch (_: Exception) {}
        recognizer = null
    }

    fun isRunning(): Boolean = isActive

    private fun beginListening() {
        if (!isActive || recognizer == null) return

        // Claim audio focus briefly to suppress the SpeechRecognizer beep.
        // Released in onReadyForSpeech once the recognizer is actively listening.
        claimAudioFocus()

        try {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "he-IL")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            recognizer?.startListening(intent)
        } catch (_: Exception) {
            abandonAudioFocus()
            scheduleRelisten(ERROR_RELISTEN_DELAY_MS)
        }
    }

    private fun scheduleRelisten(delayMs: Long) {
        if (!isActive) return
        mainHandler.postDelayed({ beginListening() }, delayMs)
    }

    // ── Audio focus to suppress beep ────────────────────────────────

    @Suppress("DEPRECATION")
    private fun claimAudioFocus() {
        abandonAudioFocus()
        audioFocusRequest = AudioManager.OnAudioFocusChangeListener {}
        audioManager.requestAudioFocus(
            audioFocusRequest,
            AudioManager.STREAM_MUSIC,
            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
        )
    }

    @Suppress("DEPRECATION")
    private fun abandonAudioFocus() {
        audioFocusRequest?.let {
            audioManager.abandonAudioFocus(it)
        }
        audioFocusRequest = null
    }

    // ── Recognition listener ────────────────────────────────────────

    private fun createListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                // Recognizer is now listening — release audio focus so TTS works
                abandonAudioFocus()
            }
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(eventType: Int, params: Bundle?) {}

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: return
                checkWakePhrase(text)
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""

                if (text.isNotBlank()) {
                    val detected = checkWakePhrase(text)
                    if (detected) return
                }

                scheduleRelisten(RELISTEN_DELAY_MS)
            }

            override fun onError(error: Int) {
                abandonAudioFocus()
                when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH,
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                        scheduleRelisten(RELISTEN_DELAY_MS)
                    }
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> {
                        scheduleRelisten(BUSY_RELISTEN_DELAY_MS)
                    }
                    SpeechRecognizer.ERROR_CLIENT,
                    SpeechRecognizer.ERROR_AUDIO -> {
                        recreateRecognizer()
                    }
                    else -> {
                        scheduleRelisten(ERROR_RELISTEN_DELAY_MS)
                    }
                }
            }
        }
    }

    private fun recreateRecognizer() {
        if (!isActive) return
        try {
            recognizer?.cancel()
            recognizer?.destroy()
        } catch (_: Exception) {}
        recognizer = null

        mainHandler.postDelayed({
            if (!isActive) return@postDelayed
            try {
                recognizer = SpeechRecognizer.createSpeechRecognizer(context)
                recognizer?.setRecognitionListener(createListener())
                beginListening()
            } catch (_: Exception) {}
        }, ERROR_RELISTEN_DELAY_MS)
    }

    private fun checkWakePhrase(text: String): Boolean {
        val normalized = text.trim().lowercase()

        for (variant in matchVariants) {
            if (normalized.startsWith(variant)) {
                val remaining = normalized.removePrefix(variant).trim()
                isActive = false
                mainHandler.removeCallbacksAndMessages(null)
                abandonAudioFocus()
                try {
                    recognizer?.stopListening()
                    recognizer?.cancel()
                    recognizer?.destroy()
                } catch (_: Exception) {}
                recognizer = null
                mainHandler.post { onWakeWordDetected(remaining) }
                return true
            }
        }
        return false
    }

    private fun getMatchVariants(phrase: String): List<String> {
        return when (phrase) {
            "היי דברי" -> listOf(
                "היי דברי", "הי דברי", "היידברי", "הידברי",
                "hey dabri", "hi dabri", "hey davri", "hi davri"
            )
            "היי סירי" -> listOf(
                "היי סירי", "הי סירי", "הייסירי", "היסירי",
                "hey siri", "hi siri"
            )
            else -> listOf(phrase.trim().lowercase())
        }
    }
}
