package com.dabri.backgroundservice

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = BackgroundServiceModule.NAME)
class BackgroundServiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BackgroundServiceModule"
    }

    // Use applicationContext to avoid "not attached to activity" crashes
    private val appContext: Context get() = reactContext.applicationContext

    override fun getName() = NAME

    @ReactMethod
    fun startService(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(appContext)) {
                promise.reject("OVERLAY_PERMISSION_REQUIRED", "Overlay permission is not granted")
                return
            }

            val intent = Intent(appContext, DabriFloatingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                appContext.startForegroundService(intent)
            } else {
                appContext.startService(intent)
            }

            ServiceStateManager.setEnabled(appContext, true)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.message ?: "Failed to start service", e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val intent = Intent(appContext, DabriFloatingService::class.java).apply {
                action = DabriFloatingService.ACTION_STOP
            }
            appContext.startService(intent)
            ServiceStateManager.setEnabled(appContext, false)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message ?: "Failed to stop service", e)
        }
    }

    @ReactMethod
    fun pauseService(promise: Promise) {
        try {
            val intent = Intent(appContext, DabriFloatingService::class.java).apply {
                action = DabriFloatingService.ACTION_PAUSE
            }
            appContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", e.message ?: "Failed to pause service", e)
        }
    }

    @ReactMethod
    fun resumeService(promise: Promise) {
        try {
            val intent = Intent(appContext, DabriFloatingService::class.java).apply {
                action = DabriFloatingService.ACTION_RESUME
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                appContext.startForegroundService(intent)
            } else {
                appContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESUME_ERROR", e.message ?: "Failed to resume service", e)
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        try {
            promise.resolve(ServiceStateManager.wasEnabled(appContext))
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", e.message ?: "Failed to check service state", e)
        }
    }

    @ReactMethod
    fun getServiceState(promise: Promise) {
        try {
            val enabled = ServiceStateManager.wasEnabled(appContext)
            promise.resolve(if (enabled) "running" else "stopped")
        } catch (e: Exception) {
            promise.reject("STATE_ERROR", e.message ?: "Failed to get service state", e)
        }
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(appContext)
            } else {
                true
            }
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("OVERLAY_CHECK_ERROR", e.message ?: "Failed to check overlay permission", e)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${appContext.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                appContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OVERLAY_REQUEST_ERROR", e.message ?: "Failed to request overlay permission", e)
        }
    }

    @ReactMethod
    fun checkAllPermissions(promise: Promise) {
        try {
            val map = Arguments.createMap()

            val overlayGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(appContext)
            } else {
                true
            }
            map.putBoolean("overlayGranted", overlayGranted)

            val notificationsGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    appContext, Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
            map.putBoolean("notificationsGranted", notificationsGranted)

            val microphoneGranted = ContextCompat.checkSelfPermission(
                appContext, Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
            map.putBoolean("microphoneGranted", microphoneGranted)

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("PERMISSIONS_CHECK_ERROR", e.message ?: "Failed to check permissions", e)
        }
    }

    @ReactMethod
    fun setWakeWordConfig(enabled: Boolean, phrase: String, promise: Promise) {
        try {
            ServiceStateManager.setWakeWordConfig(appContext, enabled, phrase)

            // Notify the running service to update wake word state
            val intent = Intent(appContext, DabriFloatingService::class.java).apply {
                action = DabriFloatingService.ACTION_WAKE_WORD_CONFIG
                putExtra("wake_word_enabled", enabled)
                putExtra("wake_word_phrase", phrase)
            }
            appContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WAKE_WORD_ERROR", e.message ?: "Failed to set wake word config", e)
        }
    }

    @ReactMethod
    fun getWakeWordConfig(promise: Promise) {
        try {
            val map = Arguments.createMap()
            map.putBoolean("enabled", ServiceStateManager.isWakeWordEnabled(appContext))
            map.putString("phrase", ServiceStateManager.getWakeWordPhrase(appContext))
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("WAKE_WORD_ERROR", e.message ?: "Failed to get wake word config", e)
        }
    }

    @ReactMethod
    fun notifyCommandResult(success: Boolean, message: String, promise: Promise) {
        try {
            val intent = Intent(appContext, DabriFloatingService::class.java).apply {
                action = DabriFloatingService.ACTION_COMMAND_RESULT
                putExtra(DabriFloatingService.EXTRA_RESULT_SUCCESS, success)
                putExtra(DabriFloatingService.EXTRA_RESULT_MESSAGE, message)
            }
            appContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESULT_ERROR", e.message ?: "Failed to notify command result", e)
        }
    }
}
