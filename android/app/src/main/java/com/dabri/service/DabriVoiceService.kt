package com.dabri.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.dabri.service.audio.WakeWordDetector
import com.dabri.service.config.ServicePreferences
import com.dabri.service.overlay.FloatingBubbleManager
import com.dabri.service.overlay.OverlayPermissionHelper
import com.dabri.service.overlay.VoiceOverlayManager
import com.dabri.service.pipeline.VoicePipelineController

class DabriVoiceService : Service() {

    companion object {
        private const val TAG = "DabriVoiceService"

        const val ACTION_START = "com.dabri.service.START"
        const val ACTION_STOP = "com.dabri.service.STOP"
        const val ACTION_TOGGLE_LISTENING = "com.dabri.service.TOGGLE_LISTENING"
        const val ACTION_BUBBLE_TAP = "com.dabri.service.BUBBLE_TAP"

        @Volatile
        var isRunning: Boolean = false
            private set

        fun start(context: Context) {
            val intent = Intent(context, DabriVoiceService::class.java).apply {
                action = ACTION_START
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, DabriVoiceService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private lateinit var preferences: ServicePreferences
    private var pipelineController: VoicePipelineController? = null
    private var bubbleManager: FloatingBubbleManager? = null
    private var overlayManager: VoiceOverlayManager? = null
    private var wakeWordDetector: WakeWordDetector? = null
    private var isListeningPaused = false

    // Phone state
    @Suppress("DEPRECATION")
    private var phoneStateListener: PhoneStateListener? = null
    private var telephonyCallback: Any? = null // TelephonyCallback for API 31+
    private var isInCall = false

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service onCreate")
        preferences = ServicePreferences(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                shutdown()
                return START_NOT_STICKY
            }
            ACTION_TOGGLE_LISTENING -> {
                toggleListening()
                return START_STICKY
            }
            ACTION_BUBBLE_TAP -> {
                onBubbleTapped()
                return START_STICKY
            }
            ACTION_START, null -> {
                if (!isRunning) {
                    startServiceForeground()
                }
                return START_STICKY
            }
            else -> return START_STICKY
        }
    }

    private fun startServiceForeground() {
        Log.d(TAG, "Starting foreground service")
        isRunning = true
        preferences.serviceEnabled = true

        // Show foreground notification immediately
        val notification = ServiceNotificationHelper.buildNotification(this, PipelineState.IDLE)
        startForeground(ServiceNotificationHelper.NOTIFICATION_ID, notification)

        // Initialize components
        initializeComponents()
    }

    private fun initializeComponents() {
        // Pipeline controller (STT, TTS, Gemini)
        try {
            pipelineController = VoicePipelineController(
                context = this,
                preferences = preferences,
                onStateChanged = { state, transcript -> onPipelineStateChanged(state, transcript) }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to init pipeline", e)
        }

        // Floating bubble
        try {
            if (OverlayPermissionHelper.canDrawOverlays(this)) {
                bubbleManager = FloatingBubbleManager(
                    context = this,
                    onTap = { onBubbleTapped() },
                    onLongPress = { }
                )
                bubbleManager?.show()

                overlayManager = VoiceOverlayManager(
                    context = this,
                    onClose = { pipelineController?.cancel() },
                    onMicTap = { onBubbleTapped() }
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to init overlay", e)
        }

        // Wake word detector
        try {
            initializeWakeWord()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to init wake word", e)
            updateState(PipelineState.DEGRADED)
        }

        // Phone state listener
        try {
            registerPhoneStateListener()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register phone state listener", e)
        }
    }

    private fun initializeWakeWord() {
        wakeWordDetector = WakeWordDetector(
            context = this,
            sensitivity = preferences.wakeWordSensitivity,
            onWakeWordDetected = { onWakeWordDetected() },
            onError = { error ->
                Log.e(TAG, "Wake word error: $error")
                updateState(PipelineState.DEGRADED)
            }
        )
        wakeWordDetector?.start()
        updateState(PipelineState.IDLE)
    }

    private fun onWakeWordDetected() {
        Log.d(TAG, "Wake word detected!")
        if (isInCall || isListeningPaused) return

        // Stop wake word detection (can't use mic simultaneously)
        wakeWordDetector?.stop()

        // Show overlay and start voice interaction
        bubbleManager?.updateState(PipelineState.RECOGNIZING)
        overlayManager?.show()
        pipelineController?.onWakeWordDetected()
    }

    private fun onBubbleTapped() {
        val currentState = pipelineController?.state ?: PipelineState.IDLE

        when (currentState) {
            PipelineState.SPEAKING -> {
                // Stop TTS, return to idle
                pipelineController?.cancel()
            }
            PipelineState.RECOGNIZING -> {
                // Force-finish STT with current transcript
                pipelineController?.finishRecognizing()
            }
            PipelineState.IDLE, PipelineState.DEGRADED, PipelineState.PAUSED -> {
                // Start voice interaction
                wakeWordDetector?.stop()
                overlayManager?.show()
                pipelineController?.onBubbleTapped()
            }
            else -> {
                // Ignore taps during PARSING, EXECUTING
            }
        }
    }

    private fun onPipelineStateChanged(state: PipelineState, transcript: String?) {
        // Update notification
        val notification = ServiceNotificationHelper.buildNotification(this, state, transcript)
        val notificationManager = getSystemService(android.app.NotificationManager::class.java)
        notificationManager?.notify(ServiceNotificationHelper.NOTIFICATION_ID, notification)

        // Update bubble
        bubbleManager?.updateState(state)

        // Update overlay
        when (state) {
            PipelineState.RECOGNIZING -> {
                overlayManager?.updateStatus(state)
                if (transcript != null) overlayManager?.updateTranscript(transcript)
            }
            PipelineState.PARSING, PipelineState.EXECUTING -> {
                overlayManager?.updateStatus(state)
            }
            PipelineState.SPEAKING -> {
                overlayManager?.updateStatus(state)
                if (transcript != null) overlayManager?.updateResult(transcript)
            }
            PipelineState.IDLE, PipelineState.DEGRADED -> {
                // Interaction complete, auto-dismiss overlay after delay
                overlayManager?.scheduleHide(3000)
                // Restart wake word detection
                if (!isInCall && !isListeningPaused) {
                    wakeWordDetector?.start()
                }
            }
            PipelineState.ERROR -> {
                overlayManager?.updateStatus(state)
                overlayManager?.scheduleHide(3000)
                if (!isInCall && !isListeningPaused) {
                    wakeWordDetector?.start()
                }
            }
            else -> {}
        }
    }

    private fun toggleListening() {
        if (isListeningPaused) {
            isListeningPaused = false
            if (!isInCall) {
                wakeWordDetector?.start()
                updateState(
                    if (wakeWordDetector != null) PipelineState.IDLE else PipelineState.DEGRADED
                )
            }
        } else {
            isListeningPaused = true
            wakeWordDetector?.stop()
            pipelineController?.cancel()
            updateState(PipelineState.PAUSED)
        }
    }

    private fun updateState(state: PipelineState) {
        val notification = ServiceNotificationHelper.buildNotification(this, state)
        val notificationManager = getSystemService(android.app.NotificationManager::class.java)
        notificationManager?.notify(ServiceNotificationHelper.NOTIFICATION_ID, notification)
        bubbleManager?.updateState(state)
    }

    @Suppress("DEPRECATION")
    private fun registerPhoneStateListener() {
        val telephonyManager = getSystemService(TelephonyManager::class.java) ?: return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val callback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                override fun onCallStateChanged(state: Int) {
                    handleCallStateChange(state)
                }
            }
            telephonyManager.registerTelephonyCallback(mainExecutor, callback)
            telephonyCallback = callback
        } else {
            val listener = object : PhoneStateListener() {
                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    handleCallStateChange(state)
                }
            }
            telephonyManager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
            phoneStateListener = listener
        }
    }

    private fun handleCallStateChange(state: Int) {
        when (state) {
            TelephonyManager.CALL_STATE_RINGING,
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (!isInCall) {
                    isInCall = true
                    Log.d(TAG, "Phone call started, pausing wake word")
                    wakeWordDetector?.stop()
                    pipelineController?.cancel()
                    updateState(PipelineState.PHONE_CALL_PAUSED)
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                if (isInCall) {
                    isInCall = false
                    Log.d(TAG, "Phone call ended, resuming")
                    // Delay resume to let telephony release mic
                    android.os.Handler(mainLooper).postDelayed({
                        if (!isListeningPaused && isRunning) {
                            wakeWordDetector?.start()
                            updateState(
                                if (wakeWordDetector != null) PipelineState.IDLE
                                else PipelineState.DEGRADED
                            )
                        }
                    }, 2000)
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun unregisterPhoneStateListener() {
        val telephonyManager = getSystemService(TelephonyManager::class.java) ?: return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (telephonyCallback as? TelephonyCallback)?.let {
                telephonyManager.unregisterTelephonyCallback(it)
            }
            telephonyCallback = null
        } else {
            phoneStateListener?.let {
                telephonyManager.listen(it, PhoneStateListener.LISTEN_NONE)
            }
            phoneStateListener = null
        }
    }

    private fun shutdown() {
        Log.d(TAG, "Shutting down service")
        isRunning = false
        preferences.serviceEnabled = false

        unregisterPhoneStateListener()
        wakeWordDetector?.destroy()
        wakeWordDetector = null
        pipelineController?.destroy()
        pipelineController = null
        overlayManager?.hide()
        overlayManager = null
        bubbleManager?.hide()
        bubbleManager = null

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.d(TAG, "Task removed, service continues (stopWithTask=false)")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Service onDestroy")
        isRunning = false
        wakeWordDetector?.destroy()
        pipelineController?.destroy()
        overlayManager?.hide()
        bubbleManager?.hide()
        unregisterPhoneStateListener()
    }
}
