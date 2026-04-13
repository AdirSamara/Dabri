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

        private const val RECOGNIZER_RESET_DELAY_MS = 150L
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
            onBubbleLongPressed = { handleBubbleLongPress() },
            onBubbleDismissed = { handleBubbleDismissed() }
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
        destroyRecognizer()
        voiceOverlayManager?.hide()
        bubbleManager?.hide()
        tts?.stop()
        tts?.shutdown()
        bubbleManager = null
        voiceOverlayManager = null
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
        destroyRecognizer()
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
        destroyRecognizer()
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

    private fun handleBubbleDismissed() {
        // User dragged bubble to X zone — hide bubble but keep service running
        bubbleManager?.hide()
    }

    private fun handleOverlayClose() {
        destroyRecognizer()
        tts?.stop()
        voiceOverlayManager?.hide()
        bubbleManager?.updateState("running")
        emitState("running")
    }

    // ── Speech Recognition ──────────────────────────────────────────

    private fun startListening() {
        if (isListening) return
        isListening = true

        // Destroy any existing recognizer first, then create fresh after a delay
        destroyRecognizer()

        mainHandler.postDelayed({
            try {
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
                mainHandler.post {
                    voiceOverlayManager?.updateStatus("idle")
                    voiceOverlayManager?.updateTranscript("שגיאה בהפעלת המיקרופון")
                }
            }
        }, RECOGNIZER_RESET_DELAY_MS)
    }

    private fun destroyRecognizer() {
        isListening = false
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        speechRecognizer = null
    }

    private fun createRecognitionListener(): RecognitionListener {
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
                mainHandler.post {
                    voiceOverlayManager?.updateTranscript(text)
                }
                emitTranscript(text, isFinal = false)
            }

            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""

                // Bug 7 fix: Close overlay IMMEDIATELY after final result.
                // Bubble stays in "processing" state while JS processes the command.
                mainHandler.post {
                    voiceOverlayManager?.hide()
                    bubbleManager?.updateState("processing")
                }
                emitState("processing")
                emitTranscript(text, isFinal = true)

                // Destroy recognizer so next attempt starts clean (Bug 5)
                destroyRecognizer()
            }

            override fun onError(error: Int) {
                isListening = false
                // Destroy recognizer on error so next attempt is clean (Bug 5)
                destroyRecognizer()

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
                // Auto-close overlay after showing error briefly
                mainHandler.postDelayed({
                    voiceOverlayManager?.hide()
                    emitState("running")
                }, 2000L)
            }
        }
    }

    // ── Command result from JS ──────────────────────────────────────

    fun handleCommandResult(intent: Intent) {
        val success = intent.getBooleanExtra(EXTRA_RESULT_SUCCESS, false)
        val message = intent.getStringExtra(EXTRA_RESULT_MESSAGE) ?: ""

        // Bug 7: Overlay is already closed at this point. Just speak result via TTS.
        mainHandler.post {
            bubbleManager?.updateState("speaking")
        }
        emitState("speaking")

        speakResult(message)
    }

    // ── TTS ─────────────────────────────────────────────────────────

    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale("he", "IL")
                tts?.setSpeechRate(0.85f)
                ttsReady = true
            }
        }
    }

    private fun speakResult(text: String) {
        if (!ttsReady || text.isBlank()) {
            resetToRunning()
            return
        }

        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) {
                mainHandler.post { resetToRunning() }
            }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                mainHandler.post { resetToRunning() }
            }
        })

        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "dabri_result")
    }

    // Bug 10: Always reset bubble to "running" after TTS finishes
    private fun resetToRunning() {
        bubbleManager?.updateState("running")
        emitState("running")
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
