package com.dabri.reminder

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = ReminderModule.NAME)
class ReminderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ReminderModule"
        private const val REQUEST_CODE_NOTIFICATION = 1001
    }

    private var notificationPermissionPromise: Promise? = null

    private val activityEventListener: ActivityEventListener =
        object : BaseActivityEventListener() {
            override fun onActivityResult(
                activity: Activity, requestCode: Int, resultCode: Int, data: Intent?
            ) {
                // Not used for permission requests, but kept for potential future use
            }
        }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    override fun getName() = NAME

    @ReactMethod
    fun createNotificationChannel(promise: Promise) {
        try {
            ReminderScheduler.ensureChannel(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CHANNEL_ERROR", e.message ?: "Failed to create notification channel", e)
        }
    }

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        try {
            val map = Arguments.createMap()

            // Check exact alarm permission (API 31+)
            val canScheduleExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val alarmManager = reactContext.getSystemService(AlarmManager::class.java)
                alarmManager?.canScheduleExactAlarms() ?: false
            } else {
                true // No restriction below API 31
            }

            // Check notification permission (API 33+)
            val canPostNotifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    reactContext, Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true // No runtime permission needed below API 33
            }

            map.putBoolean("canScheduleExact", canScheduleExact)
            map.putBoolean("canPostNotifications", canPostNotifications)
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message ?: "Failed to check permissions", e)
        }
    }

    @ReactMethod
    fun requestExactAlarmPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EXACT_ALARM_ERROR", e.message ?: "Failed to request exact alarm permission", e)
        }
    }

    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val activity = reactContext.currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "No active activity to request permission")
                    return
                }

                // Store promise to resolve when permission result comes back
                notificationPermissionPromise = promise

                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    REQUEST_CODE_NOTIFICATION
                )

                // Since we can't easily get the callback in a ReactModule,
                // resolve immediately — the JS side should call checkPermissions()
                // after a short delay to verify the result
                notificationPermissionPromise = null
                promise.resolve(true)
            } else {
                promise.resolve(true) // No permission needed below API 33
            }
        } catch (e: Exception) {
            notificationPermissionPromise = null
            promise.reject("NOTIFICATION_PERM_ERROR", e.message ?: "Failed to request notification permission", e)
        }
    }

    @ReactMethod
    fun scheduleReminder(id: String, text: String, triggerTimeMs: Double, promise: Promise) {
        try {
            val triggerTime = triggerTimeMs.toLong()

            // Save to SharedPreferences (for boot recovery)
            ReminderScheduler.saveReminder(reactContext, id, text, triggerTime)

            // Schedule the alarm
            ReminderScheduler.scheduleAlarm(reactContext, id, text, triggerTime)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message ?: "Failed to schedule reminder", e)
        }
    }

    @ReactMethod
    fun cancelReminder(id: String, promise: Promise) {
        try {
            ReminderScheduler.cancelAlarm(reactContext, id)
            ReminderScheduler.removeReminder(reactContext, id)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message ?: "Failed to cancel reminder", e)
        }
    }

    @ReactMethod
    fun snoozeReminder(id: String, text: String, snoozeMinutes: Int, promise: Promise) {
        try {
            // Cancel current notification
            val notificationManager = androidx.core.app.NotificationManagerCompat.from(reactContext)
            notificationManager.cancel(id.hashCode())

            // Calculate new trigger time
            val newTriggerTime = System.currentTimeMillis() + (snoozeMinutes * 60 * 1000L)

            // Update SharedPreferences and re-schedule
            ReminderScheduler.saveReminder(reactContext, id, text, newTriggerTime)
            ReminderScheduler.scheduleAlarm(reactContext, id, text, newTriggerTime)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SNOOZE_ERROR", e.message ?: "Failed to snooze reminder", e)
        }
    }
}
