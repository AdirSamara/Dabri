package com.dabri.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.dabri.service.config.ServicePreferences

class ServiceBootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ServiceBootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED) return

        Log.d(TAG, "Received: $action")

        val prefs = ServicePreferences(context)
        if (!prefs.serviceEnabled || !prefs.autoStartOnBoot) {
            Log.d(TAG, "Service not enabled or auto-start disabled, skipping")
            return
        }

        if (Build.VERSION.SDK_INT >= 34) {
            // Android 14+: Cannot start microphone foreground service from boot receiver
            // Post a notification instead that user can tap to start service
            Log.d(TAG, "API 34+: Posting activation notification")
            postActivationNotification(context)
        } else {
            // API 24-33: Can start service directly
            Log.d(TAG, "Starting service directly from boot receiver")
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    DabriVoiceService.start(context)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start service from boot", e)
                    postActivationNotification(context)
                }
            }, 3000)
        }
    }

    private fun postActivationNotification(context: Context) {
        try {
            val notification = ServiceNotificationHelper.buildBootNotification(context)
            NotificationManagerCompat.from(context).notify(
                ServiceNotificationHelper.NOTIFICATION_ID + 100,
                notification
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Cannot post notification (permission not granted)", e)
        }
    }
}
