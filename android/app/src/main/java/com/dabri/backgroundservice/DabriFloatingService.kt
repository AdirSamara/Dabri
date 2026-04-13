package com.dabri.backgroundservice

import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.dabri.MainApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

class DabriFloatingService : Service() {

    companion object {
        const val ACTION_PAUSE = "com.dabri.SERVICE_PAUSE"
        const val ACTION_RESUME = "com.dabri.SERVICE_RESUME"
        const val ACTION_STOP = "com.dabri.SERVICE_STOP"
        const val ACTION_COMMAND_RESULT = "com.dabri.SERVICE_COMMAND_RESULT"
        const val EXTRA_RESULT_SUCCESS = "result_success"
        const val EXTRA_RESULT_MESSAGE = "result_message"

        private const val AUTO_CLOSE_DELAY_MS = 3000L
        private const val LOCALE_HEBREW = "he-IL"
    }

    private var notificationManager: ServiceNotificationManager? = null
    private var bubbleManager: BubbleManager? = null
    private var voiceOverlayManager: VoiceOverlayManager? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var isPaused = false
    private var isListening = false
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        notificationManager = ServiceNotificationManager(this)
        notificationManager?.createChannel()
        startForeground(
            ServiceNotificationManager.NOTIFICATION_ID,
            notificationManager!!.buildNotification(isPaused = false)
        )

        bubbleManager = BubbleManager(
            context = this,
            onBubbleTapped = { handleBubbleTap() },
            onBubbleLongPressed = { handleBubbleLongPress() }
        )

        voiceOverlayManager = VoiceOverlayManager(
            context = this,
            onClose = { handleOverlayClose() }
        )

        initTts()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PAUSE -> handlePause()
            ACTION_RESUME -> handleResume()
            ACTION_STOP -> handleStop()
            ACTION_COMMAND_RESULT -> handleCommandResult(intent)
            else -> handleStart()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopListening()
        voiceOverlayManager?.hide()
        bubbleManager?.hide()
        speechRecognizer?.destroy()
        tts?.stop()
        tts?.shutdown()
        bubbleManager = null
        voiceOverlayManager = null
        speechRecognizer = null
        tts = null
        super.onDestroy()
        emitState("stopped")
    }

    // ── Service state handlers ──────────────────────────────────────

    private fun handleStart() {
        isPaused = false
        ServiceStateManager.setEnabled(this, true)
        notificationManager?.updateNotification(isPaused = false)
        showBubble()
        emitState("running")
    }

    private fun handlePause() {
        isPaused = true
        stopListening()
        voiceOverlayManager?.hide()
        bubbleManager?.hide()
        notificationManager?.updateNotification(isPaused = true)
        emitState("paused")
    }

    private fun handleResume() {
        isPaused = false
        notificationManager?.updateNotification(isPaused = false)
        showBubble()
        emitState("running")
    }

    private fun handleStop() {
        ServiceStateManager.setEnabled(this, false)
        stopListening()
        voiceOverlayManager?.hide()
        bubbleManager?.hide()
        stopSelf()
    }

    // ── Bubble management ───────────────────────────────────────────

    private fun showBubble() {
        if (!Settings.canDrawOverlays(this)) return
        bubbleManager?.show()
        bubbleManager?.updateState("running")
    }

    private fun handleBubbleTap() {
        if (voiceOverlayManager?.isShowing() == true) {
            // Tapping bubble while overlay is open = cancel
            handleOverlayClose()
            return
        }

        // Check if mic is available
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (audioManager.mode == AudioManager.MODE_IN_CALL ||
            audioManager.mode == AudioManager.MODE_IN_COMMUNICATION) {
            return
        }

        // Show overlay and start listening
        if (Settings.canDrawOverlays(this)) {
            voiceOverlayManager?.show()
            voiceOverlayManager?.updateStatus("listening")
            bubbleManager?.updateState("listening")
            startListening()
            emitState("listening")
        }
    }

    private fun handleBubbleLongPress() {
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(launchIntent)
        } catch (_: Exception) {}
    }

    private fun handleOverlayClose() {
        stopListening()
        tts?.stop()
        voiceOverlayManager?.hide()
        bubbleManager?.updateState("running")
        emitState("running")
    }

    // ── Speech Recognition ──────────────────────────────────────────

    private fun startListening() {
        if (isListening) return
        isListening = true

        mainHandler.post {
            try {
                speechRecognizer?.destroy()
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
                speechRecognizer?.setRecognitionListener(createRecognitionListener())

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, LOCALE_HEBREW)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                }
                speechRecognizer?.startListening(intent)
            } catch (_: Exception) {
                isListening = false
                voiceOverlayManager?.updateStatus("idle")
                voiceOverlayManager?.updateTranscript("שגיאה בהפעלת המיקרופון")
            }
        }
    }

    private fun stopListening() {
        isListening = false
        mainHandler.post {
            try {
                speechRecognizer?.stopListening()
                speechRecognizer?.cancel()
            } catch (_: Exception) {}
        }
    }

    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: return
                mainHandler.post {
                    voiceOverlayManager?.updateTranscript(text)
                }
                emitTranscript(text, isFinal = false)
            }

            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""

                mainHandler.post {
                    voiceOverlayManager?.updateTranscript(text)
                    voiceOverlayManager?.updateStatus("processing")
                    bubbleManager?.updateState("processing")
                }
                emitState("processing")
                emitTranscript(text, isFinal = true)
            }

            override fun onError(error: Int) {
                isListening = false
                val errorMsg = when (error) {
                    SpeechRecognizer.ERROR_AUDIO -> "המיקרופון בשימוש על ידי אפליקציה אחרת"
                    SpeechRecognizer.ERROR_NO_MATCH -> "לא הבנתי, נסה שוב"
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "לא שמעתי כלום"
                    else -> "שגיאה בזיהוי דיבור"
                }
                mainHandler.post {
                    voiceOverlayManager?.updateTranscript(errorMsg)
                    voiceOverlayManager?.updateStatus("idle")
                    bubbleManager?.updateState("running")
                }
                // Auto-close after showing error
                mainHandler.postDelayed({
                    voiceOverlayManager?.hide()
                    emitState("running")
                }, AUTO_CLOSE_DELAY_MS)
            }
        }
    }

    // ── Command result from JS ──────────────────────────────────────

    fun handleCommandResult(intent: Intent) {
        val success = intent.getBooleanExtra(EXTRA_RESULT_SUCCESS, false)
        val message = intent.getStringExtra(EXTRA_RESULT_MESSAGE) ?: ""

        mainHandler.post {
            voiceOverlayManager?.updateTranscript(message)
            voiceOverlayManager?.updateStatus("speaking")
            bubbleManager?.updateState("speaking")
        }
        emitState("speaking")

        // Speak the result
        speakResult(message)
    }

    // ── TTS ─────────────────────────────────────────────────────────

    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale("he", "IL")
                // Read speed from SharedPreferences (same key as Zustand store)
                val speed = getSharedPreferences("dabri-store", Context.MODE_PRIVATE)
                    .getString("dabri-store", null)
                // Default speed 0.6 — we'll use a reasonable default
                tts?.setSpeechRate(0.85f)
                ttsReady = true
            }
        }
    }

    private fun speakResult(text: String) {
        if (!ttsReady || text.isBlank()) {
            autoCloseOverlay()
            return
        }

        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) {
                mainHandler.post { autoCloseOverlay() }
            }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                mainHandler.post { autoCloseOverlay() }
            }
        })

        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "dabri_result")
    }

    private fun autoCloseOverlay() {
        mainHandler.postDelayed({
            voiceOverlayManager?.hide()
            bubbleManager?.updateState("running")
            emitState("running")
        }, AUTO_CLOSE_DELAY_MS)
    }

    // ── JS communication ────────────────────────────────────────────

    private fun emitState(state: String) {
        val reactContext = getReactContext()
        ServiceStateManager.emitToJS(reactContext, "backgroundServiceStateChanged", state)
    }

    private fun emitTranscript(text: String, isFinal: Boolean) {
        val reactContext = getReactContext() ?: return
        try {
            val data = Arguments.createMap().apply {
                putString("text", text)
                putBoolean("isFinal", isFinal)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("backgroundServiceTranscript", data)
        } catch (_: Exception) {}
    }

    private fun getReactContext(): ReactContext? {
        return try {
            val app = application as? MainApplication ?: return null
            app.reactHost.currentReactContext as? ReactContext
        } catch (_: Exception) {
            null
        }
    }
}
