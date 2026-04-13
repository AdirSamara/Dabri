package com.dabri.service

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.dabri.service.config.ServicePreferences
import com.dabri.service.overlay.OverlayPermissionHelper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = DabriServiceBridge.NAME)
class DabriServiceBridge(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "DabriServiceModule"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun startService(promise: Promise) {
        try {
            DabriVoiceService.start(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            DabriVoiceService.stop(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        promise.resolve(DabriVoiceService.isRunning)
    }

    @ReactMethod
    fun checkServicePermissions(promise: Promise) {
        val map = Arguments.createMap()

        // 1. Microphone
        val hasMic = ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        map.putBoolean("microphone", hasMic)

        // 2. Overlay (SYSTEM_ALERT_WINDOW)
        map.putBoolean("overlay", OverlayPermissionHelper.canDrawOverlays(reactContext))

        // 3. Notifications (API 33+)
        val hasNotifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                reactContext, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else true
        map.putBoolean("notifications", hasNotifications)

        // 4. Battery optimization exemption
        val pm = reactContext.getSystemService(PowerManager::class.java)
        val isBatteryOptExempt = pm?.isIgnoringBatteryOptimizations(reactContext.packageName) ?: false
        map.putBoolean("batteryOptimization", isBatteryOptExempt)

        promise.resolve(map)
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        OverlayPermissionHelper.requestOverlayPermission(reactContext)
        promise.resolve(true)
    }

    @ReactMethod
    fun requestBatteryOptimizationExemption(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${reactContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BATTERY_OPT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val activity = reactContext.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No active activity")
                return
            }
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                1002
            )
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun isSamsungDevice(promise: Promise) {
        promise.resolve(Build.MANUFACTURER.equals("samsung", ignoreCase = true))
    }

    @ReactMethod
    fun openSamsungBatterySettings(promise: Promise) {
        if (Build.MANUFACTURER.equals("samsung", ignoreCase = true)) {
            try {
                val intent = Intent().apply {
                    component = android.content.ComponentName(
                        "com.samsung.android.lool",
                        "com.samsung.android.sm.battery.ui.BatteryActivity"
                    )
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
                return
            } catch (_: Exception) { }
        }
        // Fallback to standard battery settings
        try {
            val intent = Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun syncSettings(settings: ReadableMap, promise: Promise) {
        try {
            val prefs = ServicePreferences(reactContext)

            if (settings.hasKey("geminiApiKey")) {
                prefs.geminiApiKey = settings.getString("geminiApiKey") ?: ""
            }
            if (settings.hasKey("preferredNavApp")) {
                prefs.preferredNavApp = settings.getString("preferredNavApp") ?: "waze"
            }
            if (settings.hasKey("homeAddress")) {
                prefs.homeAddress = settings.getString("homeAddress") ?: ""
            }
            if (settings.hasKey("workAddress")) {
                prefs.workAddress = settings.getString("workAddress") ?: ""
            }
            if (settings.hasKey("ttsSpeed")) {
                prefs.ttsSpeed = settings.getDouble("ttsSpeed").toFloat()
            }
            if (settings.hasKey("silenceTimeout")) {
                prefs.silenceTimeout = settings.getDouble("silenceTimeout").toLong()
            }
            if (settings.hasKey("wakeWordSensitivity")) {
                val sens = settings.getString("wakeWordSensitivity") ?: "medium"
                prefs.wakeWordSensitivity = when (sens) {
                    "low" -> 0.3f
                    "high" -> 0.7f
                    else -> 0.5f
                }
            }
            if (settings.hasKey("isDarkMode")) {
                prefs.isDarkMode = settings.getBoolean("isDarkMode")
            }
            if (settings.hasKey("autoStartOnBoot")) {
                prefs.autoStartOnBoot = settings.getBoolean("autoStartOnBoot")
            }
            if (settings.hasKey("showOnLockScreen")) {
                prefs.showOnLockScreen = settings.getBoolean("showOnLockScreen")
            }
            if (settings.hasKey("contactAliases")) {
                val aliasStr = settings.getString("contactAliases") ?: "{}"
                try {
                    val obj = org.json.JSONObject(aliasStr)
                    val map = mutableMapOf<String, String>()
                    obj.keys().forEach { key -> map[key] = obj.getString(key) }
                    prefs.setContactAliases(map)
                } catch (_: Exception) { }
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SYNC_ERROR", e.message, e)
        }
    }

    // Required for NativeEventEmitter compatibility
    @ReactMethod
    fun addListener(eventName: String) { }

    @ReactMethod
    fun removeListeners(count: Int) { }
}
