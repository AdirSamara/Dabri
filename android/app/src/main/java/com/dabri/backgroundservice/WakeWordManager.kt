package com.dabri.backgroundservice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Continuous wake word detection using a SINGLE SpeechRecognizer instance.
 *
 * Key design: The recognizer is created once and reused across listening cycles.
 * We only call startListening() again after each result/error — never destroy
 * and recreate. This matches how Miri keeps the mic open continuously.
 *
 * Note: We do NOT mute device streams to suppress the SpeechRecognizer beep.
 * Muting STREAM_MUSIC breaks TTS playback. The single-recognizer approach
 * already minimizes beeps (only one on initial start, not on restarts).
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

    companion object {
        private const val RELISTEN_DELAY_MS = 100L
        private const val ERROR_RELISTEN_DELAY_MS = 300L
        private const val BUSY_RELISTEN_DELAY_MS = 2000L
    }

    fun start(phrase: String) {
        stop() // clean stop first

        wakePhrase = phrase
        matchVariants = getMatchVariants(phrase)
        isActive = true

        // Create the recognizer ONCE
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
        try {
            recognizer?.stopListening()
            recognizer?.cancel()
            recognizer?.destroy()
        } catch (_: Exception) {}
        recognizer = null
    }

    fun isRunning(): Boolean = isActive

    /**
     * Start listening on the existing recognizer instance.
     * Called repeatedly — does NOT create a new recognizer.
     */
    private fun beginListening() {
        if (!isActive || recognizer == null) return

        try {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "he-IL")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            recognizer?.startListening(intent)
        } catch (_: Exception) {
            scheduleRelisten(ERROR_RELISTEN_DELAY_MS)
        }
    }

    private fun scheduleRelisten(delayMs: Long) {
        if (!isActive) return
        mainHandler.postDelayed({ beginListening() }, delayMs)
    }

    // ── Recognition listener ────────────────────────────────────────

    private fun createListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
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

                // No wake word match — re-listen on the SAME recognizer
                scheduleRelisten(RELISTEN_DELAY_MS)
            }

            override fun onError(error: Int) {
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

    /**
     * Recreate the recognizer if it enters a bad state.
     * This is the only path that destroys and recreates.
     */
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
