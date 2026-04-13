package com.dabri.backgroundservice

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

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
    private var savedNotificationVolume = 0
    private var savedMusicVolume = 0

    companion object {
        private const val RESTART_DELAY_MS = 300L
        private const val ERROR_RESTART_DELAY_MS = 500L
        private const val BUSY_RESTART_DELAY_MS = 2000L
    }

    fun start(phrase: String) {
        // Stop any existing session first
        stopInternal()

        wakePhrase = phrase
        matchVariants = getMatchVariants(phrase)
        isActive = true

        // Mute beep sounds before starting the recognition loop
        muteBeep()

        // Small delay to ensure clean state
        mainHandler.postDelayed({ startRecognizer() }, 200L)
    }

    fun stop() {
        stopInternal()
        restoreBeep()
    }

    fun isRunning(): Boolean = isActive

    private fun stopInternal() {
        isActive = false
        mainHandler.removeCallbacksAndMessages(null)
        destroyRecognizer()
    }

    private fun startRecognizer() {
        if (!isActive) return

        destroyRecognizer()

        try {
            // Always use cloud recognizer — on-device often lacks Hebrew support
            recognizer = SpeechRecognizer.createSpeechRecognizer(context)
            recognizer?.setRecognitionListener(createListener())

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "he-IL")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            recognizer?.startListening(intent)
        } catch (_: Exception) {
            scheduleRestart(ERROR_RESTART_DELAY_MS)
        }
    }

    private fun destroyRecognizer() {
        try {
            recognizer?.stopListening()
            recognizer?.cancel()
            recognizer?.destroy()
        } catch (_: Exception) {}
        recognizer = null
    }

    private fun scheduleRestart(delayMs: Long) {
        if (!isActive) return
        mainHandler.postDelayed({ startRecognizer() }, delayMs)
    }

    // ── Mute/restore beep sounds ────────────────────────────────────
    // SpeechRecognizer plays a beep on every startListening().
    // Mute notification and music streams to suppress it during wake word loop.

    private fun muteBeep() {
        try {
            savedNotificationVolume = audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION)
            savedMusicVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, 0, 0)
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, 0, 0)
        } catch (_: Exception) {}
    }

    private fun restoreBeep() {
        try {
            audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, savedNotificationVolume, 0)
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, savedMusicVolume, 0)
        } catch (_: Exception) {}
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

                // No wake word match — restart loop
                destroyRecognizer()
                scheduleRestart(RESTART_DELAY_MS)
            }

            override fun onError(error: Int) {
                destroyRecognizer()
                when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH,
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                        // Normal — user wasn't speaking. Restart.
                        scheduleRestart(RESTART_DELAY_MS)
                    }
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> {
                        scheduleRestart(BUSY_RESTART_DELAY_MS)
                    }
                    else -> {
                        scheduleRestart(ERROR_RESTART_DELAY_MS)
                    }
                }
            }
        }
    }

    /**
     * Check if the recognized text starts with the wake phrase.
     * Returns true if wake phrase was detected (stops the loop).
     */
    private fun checkWakePhrase(text: String): Boolean {
        val normalized = text.trim().lowercase()

        for (variant in matchVariants) {
            if (normalized.startsWith(variant)) {
                val remaining = normalized.removePrefix(variant).trim()
                // Wake word detected — stop listening, restore audio, notify
                isActive = false
                mainHandler.removeCallbacksAndMessages(null)
                destroyRecognizer()
                restoreBeep()
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
