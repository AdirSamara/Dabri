package com.dabri.backgroundservice

import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Hybrid wake word detection:
 *
 * - AudioRecord runs continuously to keep the green privacy dot on.
 *   It does NOT process audio — it's purely for the mic indicator.
 *
 * - SpeechRecognizer runs in parallel for actual wake word detection.
 *   On timeout/error, it restarts with audio focus held to suppress beeps.
 *   AudioRecord keeps the green dot visible during restart gaps.
 *
 * This gives: constant green dot + actual wake word detection + minimal beeps.
 */
class WakeWordManager(
    private val context: Context,
    private val onWakeWordDetected: (remainingText: String) -> Unit
) {
    private var isActive = false
    private var wakePhrase = "היי דברי"
    private var matchVariants: List<String> = getMatchVariants(wakePhrase)
    private val mainHandler = Handler(Looper.getMainLooper())

    // AudioRecord: keeps green dot on, does not process audio
    private var audioRecord: AudioRecord? = null
    private var micThread: Thread? = null

    // SpeechRecognizer: actual wake word detection
    private var recognizer: SpeechRecognizer? = null
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var audioFocusListener: AudioManager.OnAudioFocusChangeListener? = null

    companion object {
        private const val SAMPLE_RATE = 16000
        private const val RELISTEN_DELAY_MS = 500L
        private const val ERROR_RELISTEN_DELAY_MS = 2000L
    }

    fun start(phrase: String) {
        stop()
        wakePhrase = phrase
        matchVariants = getMatchVariants(phrase)
        isActive = true

        startMicIndicator()
        // Hold audio focus to suppress the first SpeechRecognizer beep
        claimAudioFocus()
        mainHandler.postDelayed({ startRecognizer() }, 200L)
    }

    fun stop() {
        isActive = false
        mainHandler.removeCallbacksAndMessages(null)
        stopRecognizer()
        stopMicIndicator()
        abandonAudioFocus()
    }

    fun isRunning(): Boolean = isActive

    // ── Mic indicator (AudioRecord) ─────────────────────────────────
    // Keeps the green privacy dot on. Reads mic data but discards it.

    private fun startMicIndicator() {
        stopMicIndicator()

        val bufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(4096)

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            )
            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                audioRecord?.release()
                audioRecord = null
                return
            }

            audioRecord?.startRecording()

            // Read and discard audio data to keep the mic active
            micThread = Thread {
                val buffer = ShortArray(1600) // 100ms chunks
                while (isActive && audioRecord != null) {
                    try {
                        audioRecord?.read(buffer, 0, buffer.size)
                    } catch (_: Exception) {
                        break
                    }
                }
            }.apply {
                name = "DabriMicIndicator"
                isDaemon = true
                start()
            }
        } catch (_: Exception) {
            audioRecord?.release()
            audioRecord = null
        }
    }

    private fun stopMicIndicator() {
        micThread?.interrupt()
        micThread = null
        try {
            audioRecord?.stop()
            audioRecord?.release()
        } catch (_: Exception) {}
        audioRecord = null
    }

    // ── SpeechRecognizer (wake word detection) ──────────────────────

    private fun startRecognizer() {
        if (!isActive) return
        stopRecognizer()

        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(context)
            recognizer?.setRecognitionListener(createListener())

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "he-IL")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                // Long silence timeouts to reduce restart frequency
                putExtra("android.speech.extra.SPEECH_INPUT_MINIMUM_LENGTH_MILLIS", 15000L)
                putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 10000L)
                putExtra("android.speech.extra.SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS", 8000L)
            }
            recognizer?.startListening(intent)
        } catch (_: Exception) {
            scheduleRestart(ERROR_RELISTEN_DELAY_MS)
        }
    }

    private fun stopRecognizer() {
        try {
            recognizer?.stopListening()
            recognizer?.cancel()
            recognizer?.destroy()
        } catch (_: Exception) {}
        recognizer = null
    }

    private fun scheduleRestart(delayMs: Long) {
        if (!isActive) return
        // Hold audio focus during the restart gap to suppress beep
        claimAudioFocus()
        mainHandler.postDelayed({
            if (isActive) startRecognizer()
        }, delayMs)
    }

    // ── Audio focus ─────────────────────────────────────────────────

    @Suppress("DEPRECATION")
    private fun claimAudioFocus() {
        abandonAudioFocus()
        audioFocusListener = AudioManager.OnAudioFocusChangeListener {}
        audioManager.requestAudioFocus(
            audioFocusListener,
            AudioManager.STREAM_MUSIC,
            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
        )
    }

    @Suppress("DEPRECATION")
    private fun abandonAudioFocus() {
        audioFocusListener?.let { audioManager.abandonAudioFocus(it) }
        audioFocusListener = null
    }

    // ── Recognition listener ────────────────────────────────────────

    private fun createListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                // Recognizer is ready — release audio focus so sounds work normally
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
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> {
                        scheduleRestart(ERROR_RELISTEN_DELAY_MS)
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
                isActive = false
                mainHandler.removeCallbacksAndMessages(null)
                stopRecognizer()
                stopMicIndicator()
                abandonAudioFocus()
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
