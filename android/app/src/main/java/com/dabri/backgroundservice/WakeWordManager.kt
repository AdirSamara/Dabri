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
import kotlin.math.abs

/**
 * Two-stage wake word detection:
 *
 * Stage 1 (AudioRecord): Keeps the mic open continuously with ZERO beeps.
 *   Monitors audio energy to detect when someone starts speaking.
 *   The green privacy dot stays on constantly.
 *
 * Stage 2 (SpeechRecognizer): Activated ONLY when voice is detected.
 *   Transcribes speech briefly and checks for the wake phrase.
 *   If matched → trigger callback. If not → return to Stage 1.
 *
 * This matches the industry standard for always-on voice assistants.
 */
class WakeWordManager(
    private val context: Context,
    private val onWakeWordDetected: (remainingText: String) -> Unit
) {
    private var isActive = false
    private var wakePhrase = "היי דברי"
    private var matchVariants: List<String> = getMatchVariants(wakePhrase)
    private val mainHandler = Handler(Looper.getMainLooper())

    // Stage 1: AudioRecord for continuous listening
    private var audioRecord: AudioRecord? = null
    private var listeningThread: Thread? = null

    // Stage 2: SpeechRecognizer for transcription (only when voice detected)
    private var recognizer: SpeechRecognizer? = null
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var audioFocusListener: AudioManager.OnAudioFocusChangeListener? = null

    companion object {
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL = AudioFormat.CHANNEL_IN_MONO
        private const val ENCODING = AudioFormat.ENCODING_PCM_16BIT

        // Energy threshold for voice activity detection.
        // Audio samples above this average amplitude trigger Stage 2.
        private const val VOICE_ENERGY_THRESHOLD = 1500
        // How many consecutive high-energy chunks needed to confirm voice
        private const val VOICE_CONFIRM_CHUNKS = 2
        // Chunk size in samples (~100ms of audio at 16kHz)
        private const val CHUNK_SAMPLES = 1600

        // After SpeechRecognizer finishes (no wake word match), wait before
        // returning to Stage 1 to avoid rapid cycling
        private const val STAGE2_COOLDOWN_MS = 300L
    }

    fun start(phrase: String) {
        stop()
        wakePhrase = phrase
        matchVariants = getMatchVariants(phrase)
        isActive = true
        startStage1()
    }

    fun stop() {
        isActive = false
        stopStage2()
        stopStage1()
    }

    fun isRunning(): Boolean = isActive

    // ── Stage 1: AudioRecord continuous listening ───────────────────

    private fun startStage1() {
        if (!isActive) return
        stopStage1()

        val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL, ENCODING)
            .coerceAtLeast(CHUNK_SAMPLES * 2)

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                CHANNEL,
                ENCODING,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                audioRecord?.release()
                audioRecord = null
                return
            }

            audioRecord?.startRecording()

            listeningThread = Thread {
                val buffer = ShortArray(CHUNK_SAMPLES)
                var highEnergyCount = 0

                while (isActive && audioRecord != null) {
                    val read = audioRecord?.read(buffer, 0, CHUNK_SAMPLES) ?: -1
                    if (read <= 0) continue

                    val energy = calculateEnergy(buffer, read)

                    if (energy > VOICE_ENERGY_THRESHOLD) {
                        highEnergyCount++
                        if (highEnergyCount >= VOICE_CONFIRM_CHUNKS) {
                            // Voice detected — switch to Stage 2
                            highEnergyCount = 0
                            mainHandler.post { switchToStage2() }
                            return@Thread
                        }
                    } else {
                        highEnergyCount = 0
                    }
                }
            }.apply {
                name = "DabriWakeWordListener"
                isDaemon = true
                start()
            }
        } catch (_: Exception) {
            audioRecord?.release()
            audioRecord = null
        }
    }

    private fun stopStage1() {
        listeningThread?.interrupt()
        listeningThread = null
        try {
            audioRecord?.stop()
            audioRecord?.release()
        } catch (_: Exception) {}
        audioRecord = null
    }

    /** Calculate average absolute amplitude of audio samples. */
    private fun calculateEnergy(buffer: ShortArray, length: Int): Int {
        var sum = 0L
        for (i in 0 until length) {
            sum += abs(buffer[i].toInt())
        }
        return (sum / length).toInt()
    }

    // ── Stage 2: SpeechRecognizer for transcription ─────────────────

    private fun switchToStage2() {
        if (!isActive) return
        stopStage1() // Release AudioRecord so SpeechRecognizer can use the mic

        // Suppress the SpeechRecognizer beep via audio focus
        claimAudioFocus()

        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(context)
            recognizer?.setRecognitionListener(createRecognitionListener())

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "he-IL")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                // Short listening window — just enough to capture wake phrase
                putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 2000L)
                putExtra("android.speech.extra.SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS", 1500L)
            }
            recognizer?.startListening(intent)
        } catch (_: Exception) {
            abandonAudioFocus()
            returnToStage1()
        }
    }

    private fun stopStage2() {
        abandonAudioFocus()
        mainHandler.removeCallbacksAndMessages(null)
        try {
            recognizer?.stopListening()
            recognizer?.cancel()
            recognizer?.destroy()
        } catch (_: Exception) {}
        recognizer = null
    }

    private fun returnToStage1() {
        stopStage2()
        if (!isActive) return
        mainHandler.postDelayed({ startStage1() }, STAGE2_COOLDOWN_MS)
    }

    // ── Audio focus for beep suppression ─────────────────────────────

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

    // ── Recognition listener (Stage 2) ──────────────────────────────

    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                // Recognizer is listening — release audio focus so user can hear feedback
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

                // No wake word — return to Stage 1
                returnToStage1()
            }

            override fun onError(error: Int) {
                // Any error — return to Stage 1
                returnToStage1()
            }
        }
    }

    private fun checkWakePhrase(text: String): Boolean {
        val normalized = text.trim().lowercase()

        for (variant in matchVariants) {
            if (normalized.startsWith(variant)) {
                val remaining = normalized.removePrefix(variant).trim()
                // Wake word detected — fully stop and notify
                isActive = false
                stopStage2()
                stopStage1()
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
