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

/**
 * Continuous wake word detection using SpeechRecognizer restart loop.
 *
 * Beep suppression: Uses adjustStreamVolume(ADJUST_MUTE) to mute ALL audio
 * streams before startListening(), and ADJUST_UNMUTE when wake word is detected
 * or manager is stopped. This is the proven pattern from KontinuousSpeechRecognizer.
 *
 * Unlike setStreamVolume(0), ADJUST_MUTE/UNMUTE is a toggle tracked by Android
 * internally — no saved values needed, no risk of permanent volume changes.
 */
class WakeWordManager(
    private val context: Context,
    private val onWakeWordDetected: (remainingText: String) -> Unit
) {
    private var recognizer: SpeechRecognizer? = null
    private var isActive = false
    private var isMuted = false
    private var wakePhrase = "היי דברי"
    private var matchVariants: List<String> = getMatchVariants(wakePhrase)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    companion object {
        private const val RELISTEN_DELAY_MS = 300L
        private const val ERROR_RELISTEN_DELAY_MS = 1500L

        private val STREAMS = intArrayOf(
            AudioManager.STREAM_MUSIC,
            AudioManager.STREAM_NOTIFICATION,
            AudioManager.STREAM_ALARM,
            AudioManager.STREAM_RING,
            AudioManager.STREAM_SYSTEM
        )
    }

    fun start(phrase: String) {
        stop()
        wakePhrase = phrase
        matchVariants = getMatchVariants(phrase)
        isActive = true
        muteAllStreams()
        startRecognizer()
    }

    fun stop() {
        isActive = false
        mainHandler.removeCallbacksAndMessages(null)
        destroyRecognizer()
        unmuteAllStreams()
    }

    fun isRunning(): Boolean = isActive

    // ── Stream muting (ADJUST_MUTE/UNMUTE) ──────────────────────────

    private fun muteAllStreams() {
        if (isMuted) return
        isMuted = true
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                for (stream in STREAMS) {
                    audioManager.adjustStreamVolume(stream, AudioManager.ADJUST_MUTE, 0)
                }
            } else {
                @Suppress("DEPRECATION")
                for (stream in STREAMS) {
                    audioManager.setStreamMute(stream, true)
                }
            }
        } catch (_: Exception) {}
    }

    private fun unmuteAllStreams() {
        if (!isMuted) return
        isMuted = false
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                for (stream in STREAMS) {
                    audioManager.adjustStreamVolume(stream, AudioManager.ADJUST_UNMUTE, 0)
                }
            } else {
                @Suppress("DEPRECATION")
                for (stream in STREAMS) {
                    audioManager.setStreamMute(stream, false)
                }
            }
        } catch (_: Exception) {}
    }

    // ── SpeechRecognizer ────────────────────────────────────────────

    private fun startRecognizer() {
        if (!isActive) return
        destroyRecognizer()

        mainHandler.post {
            try {
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
                scheduleRestart(ERROR_RELISTEN_DELAY_MS)
            }
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
                if (checkWakePhrase(text)) return
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""

                if (text.isNotBlank() && checkWakePhrase(text)) return

                // No wake word — restart
                scheduleRestart(RELISTEN_DELAY_MS)
            }

            override fun onError(error: Int) {
                when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH,
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                        scheduleRestart(RELISTEN_DELAY_MS)
                    }
                    else -> {
                        scheduleRestart(ERROR_RELISTEN_DELAY_MS)
                    }
                }
            }
        }
    }

    private fun checkWakePhrase(text: String): Boolean {
        val normalized = text.trim().lowercase()

        for (variant in matchVariants) {
            if (normalized.startsWith(variant)) {
                val remaining = normalized.removePrefix(variant).trim()
                // Wake word detected — stop everything, unmute, notify
                isActive = false
                mainHandler.removeCallbacksAndMessages(null)
                destroyRecognizer()
                unmuteAllStreams()
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
