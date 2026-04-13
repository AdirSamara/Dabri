package com.dabri.backgroundservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.dabri.R

class ServiceNotificationManager(private val context: Context) {

    companion object {
        const val CHANNEL_ID = "dabri_background_service"
        const val CHANNEL_NAME = "שירות רקע של דברי"
        const val CHANNEL_DESCRIPTION = "התראה שדברי פועלת ברקע"
        const val NOTIFICATION_ID = 2001
    }

    fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = CHANNEL_DESCRIPTION
                setShowBadge(false)
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    fun buildNotification(isPaused: Boolean): Notification {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        // Pause/Resume action
        val toggleAction = if (isPaused) {
            val resumeIntent = Intent(context, ServiceActionReceiver::class.java).apply {
                action = ServiceActionReceiver.ACTION_RESUME
            }
            val resumePending = PendingIntent.getBroadcast(context, 1, resumeIntent, flags)
            NotificationCompat.Action(0, "המשך", resumePending)
        } else {
            val pauseIntent = Intent(context, ServiceActionReceiver::class.java).apply {
                action = ServiceActionReceiver.ACTION_PAUSE
            }
            val pausePending = PendingIntent.getBroadcast(context, 1, pauseIntent, flags)
            NotificationCompat.Action(0, "השהה", pausePending)
        }

        // Stop action
        val stopIntent = Intent(context, ServiceActionReceiver::class.java).apply {
            action = ServiceActionReceiver.ACTION_STOP
        }
        val stopPending = PendingIntent.getBroadcast(context, 2, stopIntent, flags)
        val stopAction = NotificationCompat.Action(0, "כבה", stopPending)

        val title = if (isPaused) "דברי מושהית" else "דברי פעילה ברקע"
        val text = if (isPaused) "לחץ להמשך" else "לחץ על הבועה כדי לדבר"

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .addAction(toggleAction)
            .addAction(stopAction)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    fun updateNotification(isPaused: Boolean) {
        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, buildNotification(isPaused))
        } catch (_: SecurityException) {
            // Notification permission revoked
        }
    }
}
