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
import com.dabri.MainApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

class DabriFloatingService : Service() {

    companion object {
        const val ACTION_PAUSE = "com.dabri.SERVICE_PAUSE"
        const val ACTION_RESUME = "com.dabri.SERVICE_RESUME"
        const val ACTION_STOP = "com.dabri.SERVICE_STOP"
        const val ACTION_COMMAND_RESULT = "com.dabri.SERVICE_COMMAND_RESULT"
        const val ACTION_WAKE_WORD_CONFIG = "com.dabri.SERVICE_WAKE_WORD_CONFIG"
        const val ACTION_PAUSE_WAKE_WORD = "com.dabri.SERVICE_PAUSE_WAKE_WORD"
        const val ACTION_RESUME_WAKE_WORD = "com.dabri.SERVICE_RESUME_WAKE_WORD"
        const val ACTION_TTS_DONE = "com.dabri.SERVICE_TTS_DONE"
        const val EXTRA_RESULT_SUCCESS = "result_success"
        const val EXTRA_RESULT_MESSAGE = "result_message"

        private const val RECOGNIZER_RESET_DELAY_MS = 150L
        private const val LOCALE_HEBREW = "he-IL"
        private const val COMMAND_SAFETY_TIMEOUT_MS = 15000L
        private const val MAX_LISTENING_MS = 15000L
        private const val SILENCE_TIMEOUT_MS = 1500L
    }

    private var notificationManager: ServiceNotificationManager? = null
    private var bubbleManager: BubbleManager? = null
    private var voiceOverlayManager: VoiceOverlayManager? = null
    private var wakeWordManager: WakeWordManager? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var isPaused = false
    private var isListening = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var commandSafetyRunnable: Runnable? = null
    private var maxListeningRunnable: Runnable? = null
    private var silenceRunnable: Runnable? = null

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
            onClose = { handleOverlayClose() },
            onOpenApp = { handleOpenApp() }
        )

        wakeWordManager = WakeWordManager(
            context = this,
            onWakeWordDetected = { remainingText -> handleWakeWordDetected(remainingText) }
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PAUSE -> handlePause()
            ACTION_RESUME -> handleResume()
            ACTION_STOP -> handleStop()
            ACTION_COMMAND_RESULT -> handleCommandResult(intent)
            ACTION_WAKE_WORD_CONFIG -> handleWakeWordConfig(intent)
            ACTION_PAUSE_WAKE_WORD -> wakeWordManager?.stop()
            ACTION_RESUME_WAKE_WORD -> startWakeWordIfEnabled()
            ACTION_TTS_DONE -> handleTtsDone()
            else -> handleStart()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        cancelAllTimers()
        wakeWordManager?.stop()
        destroyRecognizer()
        voiceOverlayManager?.hide()
        bubbleManager?.hide()
        wakeWordManager = null
        bubbleManager = null
        voiceOverlayManager = null
        super.onDestroy()
        emitState("stopped")
    }

    // ── Service state handlers ──────────────────────────────────────

    private fun handleStart() {
        isPaused = false
        ServiceStateManager.setEnabled(this, true)
        notificationManager?.updateNotification(isPaused = false)
        showBubble()
        startWakeWordIfEnabled()
        emitState("running")
    }

    private fun handlePause() {
        isPaused = true
        cancelAllTimers()
        wakeWordManager?.stop()
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
        startWakeWordIfEnabled()
        emitState("running")
    }

    private fun handleStop() {
        ServiceStateManager.setEnabled(this, false)
        cancelAllTimers()
        wakeWordManager?.stop()
        destroyRecognizer()
        voiceOverlayManager?.hide()
        bubbleManager?.hide()
        stopSelf()
    }

    // ── Wake word ───────────────────────────────────────────────────

    private fun startWakeWordIfEnabled() {
        if (isPaused) return
        if (ServiceStateManager.isWakeWordEnabled(this)) {
            val phrase = ServiceStateManager.getWakeWordPhrase(this)
            wakeWordManager?.start(phrase)
        }
    }

    private fun handleWakeWordConfig(intent: Intent) {
        val enabled = intent.getBooleanExtra("wake_word_enabled", false)
        val phrase = intent.getStringExtra("wake_word_phrase") ?: "היי דברי"
        wakeWordManager?.stop()
        if (enabled && !isPaused) {
            wakeWordManager?.start(phrase)
        }
    }

    private fun handleWakeWordDetected(remainingText: String) {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (audioManager.mode == AudioManager.MODE_IN_CALL ||
            audioManager.mode == AudioManager.MODE_IN_COMMUNICATION) {
            startWakeWordIfEnabled()
            return
        }

        if (remainingText.isNotBlank()) {
            mainHandler.post { bubbleManager?.updateState("processing") }
            emitState("processing")
            emitTranscript(remainingText, isFinal = true)
            startCommandSafetyTimeout()
        } else {
            if (Settings.canDrawOverlays(this)) {
                mainHandler.post {
                    voiceOverlayManager?.show()
                    voiceOverlayManager?.updateStatus("listening")
                    bubbleManager?.updateState("listening")
                }
                startListening()
                emitState("listening")
            } else {
                startWakeWordIfEnabled()
            }
        }
    }

    // ── Timers ──────────────────────────────────────────────────────

    private fun cancelAllTimers() {
        cancelCommandSafetyTimeout()
        cancelListeningTimers()
    }

    private fun startCommandSafetyTimeout() {
        cancelCommandSafetyTimeout()
        commandSafetyRunnable = Runnable {
            voiceOverlayManager?.hide()
            resetToRunning()
        }
        mainHandler.postDelayed(commandSafetyRunnable!!, COMMAND_SAFETY_TIMEOUT_MS)
    }

    private fun cancelCommandSafetyTimeout() {
        commandSafetyRunnable?.let { mainHandler.removeCallbacks(it) }
        commandSafetyRunnable = null
    }

    private fun startListeningTimers() {
        cancelListeningTimers()
        maxListeningRunnable = Runnable { forceStopListening() }
        mainHandler.postDelayed(maxListeningRunnable!!, MAX_LISTENING_MS)
    }

    private fun resetSilenceTimer() {
        silenceRunnable?.let { mainHandler.removeCallbacks(it) }
        silenceRunnable = Runnable { forceStopListening() }
        mainHandler.postDelayed(silenceRunnable!!, SILENCE_TIMEOUT_MS)
    }

    private fun cancelListeningTimers() {
        maxListeningRunnable?.let { mainHandler.removeCallbacks(it) }
        maxListeningRunnable = null
        silenceRunnable?.let { mainHandler.removeCallbacks(it) }
        silenceRunnable = null
    }

    private fun forceStopListening() {
        cancelListeningTimers()
        try { speechRecognizer?.stopListening() } catch (_: Exception) {}
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

        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (audioManager.mode == AudioManager.MODE_IN_CALL ||
            audioManager.mode == AudioManager.MODE_IN_COMMUNICATION) {
            return
        }

        wakeWordManager?.stop()

        if (Settings.canDrawOverlays(this)) {
            voiceOverlayManager?.show()
            voiceOverlayManager?.updateStatus("listening")
            bubbleManager?.updateState("listening")
            startListening()
            emitState("listening")
        }
    }

    private fun handleOpenApp() {
        handleOverlayClose()
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(launchIntent)
        } catch (_: Exception) {}
    }

    private fun handleBubbleLongPress() {
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(launchIntent)
        } catch (_: Exception) {}
    }

    private fun handleBubbleDismissed() {
        wakeWordManager?.stop()
        bubbleManager?.hide()
    }

    private fun handleOverlayClose() {
        cancelAllTimers()
        destroyRecognizer()
        voiceOverlayManager?.hide()
        bubbleManager?.updateState("running")
        emitState("running")
        startWakeWordIfEnabled()
    }

    // ── Speech Recognition (command mode) ───────────────────────────

    private fun startListening() {
        if (isListening) return
        isListening = true
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
                startListeningTimers()
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
        cancelListeningTimers()
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
                mainHandler.post { voiceOverlayManager?.updateTranscript(text) }
                emitTranscript(text, isFinal = false)
                resetSilenceTimer()
            }

            override fun onResults(results: Bundle?) {
                isListening = false
                cancelListeningTimers()
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""

                mainHandler.post {
                    voiceOverlayManager?.hide()
                    bubbleManager?.updateState("processing")
                }
                emitState("processing")
                emitTranscript(text, isFinal = true)
                destroyRecognizer()
                startCommandSafetyTimeout()
            }

            override fun onError(error: Int) {
                isListening = false
                cancelListeningTimers()
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
                mainHandler.postDelayed({
                    voiceOverlayManager?.hide()
                    emitState("running")
                    startWakeWordIfEnabled()
                }, 2000L)
            }
        }
    }

    // ── Command result from JS ──────────────────────────────────────

    fun handleCommandResult(intent: Intent) {
        cancelCommandSafetyTimeout()

        val message = intent.getStringExtra(EXTRA_RESULT_MESSAGE) ?: ""

        mainHandler.post { bubbleManager?.updateState("speaking") }
        emitState("speaking")

        // Delegate TTS to JS side (react-native-tts) to avoid dual TTS instance conflict.
        // JS will call ACTION_TTS_DONE when speech finishes.
        emitSpeakRequest(message)
    }

    /** Called by JS after react-native-tts finishes speaking the result. */
    private fun handleTtsDone() {
        resetToRunning()
    }

    private fun resetToRunning() {
        bubbleManager?.updateState("running")
        emitState("running")
        startWakeWordIfEnabled()
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

    /** Ask JS to speak text via react-native-tts (single TTS instance). */
    private fun emitSpeakRequest(text: String) {
        val reactContext = getReactContext() ?: run {
            // No JS bridge — just reset
            resetToRunning()
            return
        }
        try {
            val data = Arguments.createMap().apply {
                putString("text", text)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("backgroundServiceSpeak", data)
        } catch (_: Exception) {
            resetToRunning()
        }
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
