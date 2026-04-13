package com.dabri.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.dabri.MainActivity
import com.dabri.R

object ServiceNotificationHelper {
    const val CHANNEL_ID = "dabri_voice_service"
    const val CHANNEL_NAME = "שירות קולי דברי"
    const val CHANNEL_DESCRIPTION = "שירות הקולי של דברי פעיל ברקע"
    const val NOTIFICATION_ID = 2001

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = CHANNEL_DESCRIPTION
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    fun buildNotification(
        context: Context,
        state: PipelineState,
        transcript: String? = null
    ): Notification {
        ensureChannel(context)

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_IMMUTABLE else 0

        // Tap opens the app
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val tapPendingIntent = PendingIntent.getActivity(
            context, NOTIFICATION_ID, tapIntent, flags
        )

        // Stop service action
        val stopIntent = Intent(context, ServiceActionReceiver::class.java).apply {
            action = ServiceActionReceiver.ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getBroadcast(
            context, NOTIFICATION_ID + 1, stopIntent, flags
        )

        // Pause/resume listening action
        val toggleIntent = Intent(context, ServiceActionReceiver::class.java).apply {
            action = ServiceActionReceiver.ACTION_TOGGLE_LISTENING
        }
        val togglePendingIntent = PendingIntent.getBroadcast(
            context, NOTIFICATION_ID + 2, toggleIntent, flags
        )

        val (title, text) = when (state) {
            PipelineState.IDLE -> "דברי מקשיבה" to "אמור \"היי דברי\" או לחץ על הבועה"
            PipelineState.RECOGNIZING -> "מקשיב..." to (transcript ?: "מחכה לפקודה קולית")
            PipelineState.PARSING -> "מעבד..." to (transcript ?: "מנתח את הפקודה")
            PipelineState.EXECUTING -> "מבצע..." to "מבצע את הפקודה"
            PipelineState.SPEAKING -> "מדבר..." to "משמיע תשובה"
            PipelineState.PAUSED -> "דברי מושהה" to "ההקשבה מושהית"
            PipelineState.PHONE_CALL_PAUSED -> "דברי מושהה" to "מושהה בזמן שיחה"
            PipelineState.ERROR -> "דברי - שגיאה" to "אירעה שגיאה, מנסה שוב..."
            PipelineState.DEGRADED -> "דברי - אייקון צף" to "לחץ על הבועה לפקודה קולית"
        }

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setContentIntent(tapPendingIntent)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)

        // Add actions based on state
        when (state) {
            PipelineState.IDLE, PipelineState.DEGRADED -> {
                builder.addAction(0, "השהה", togglePendingIntent)
                builder.addAction(0, "עצור שירות", stopPendingIntent)
            }
            PipelineState.PAUSED -> {
                builder.addAction(0, "חדש הקשבה", togglePendingIntent)
                builder.addAction(0, "עצור שירות", stopPendingIntent)
            }
            PipelineState.PHONE_CALL_PAUSED -> {
                builder.addAction(0, "עצור שירות", stopPendingIntent)
            }
            else -> {
                builder.addAction(0, "עצור שירות", stopPendingIntent)
            }
        }

        return builder.build()
    }

    fun buildBootNotification(context: Context): Notification {
        ensureChannel(context)

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_IMMUTABLE else 0

        val tapIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("start_service", true)
        }
        val tapPendingIntent = PendingIntent.getActivity(
            context, NOTIFICATION_ID + 10, tapIntent, flags
        )

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("דברי מוכנה")
            .setContentText("לחץ להפעלת שירות הקולי")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(tapPendingIntent)
            .build()
    }
}
