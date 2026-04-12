package com.dabri.reminder

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.dabri.MainActivity
import com.dabri.R

class ReminderAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(ReminderScheduler.EXTRA_REMINDER_ID) ?: return
        val text = intent.getStringExtra(ReminderScheduler.EXTRA_REMINDER_TEXT) ?: return

        // Ensure notification channel exists
        ReminderScheduler.ensureChannel(context)

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_IMMUTABLE else 0

        // Tap-to-open intent → opens the app
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val tapPendingIntent = PendingIntent.getActivity(
            context, id.hashCode() + 3, tapIntent, flags
        )

        // Dismiss action
        val dismissIntent = Intent(context, ReminderActionReceiver::class.java).apply {
            action = ReminderScheduler.ACTION_DISMISS
            putExtra(ReminderScheduler.EXTRA_REMINDER_ID, id)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            context, id.hashCode() + 1, dismissIntent, flags
        )

        // Snooze action
        val snoozeIntent = Intent(context, ReminderActionReceiver::class.java).apply {
            action = ReminderScheduler.ACTION_SNOOZE
            putExtra(ReminderScheduler.EXTRA_REMINDER_ID, id)
            putExtra(ReminderScheduler.EXTRA_REMINDER_TEXT, text)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            context, id.hashCode() + 2, snoozeIntent, flags
        )

        // Build notification
        val notification = NotificationCompat.Builder(context, ReminderScheduler.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("תזכורת מדברי")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(tapPendingIntent)
            .addAction(0, "בוצע", dismissPendingIntent)
            .addAction(0, "בעוד 10 דקות", snoozePendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        // Post notification (silently fails if POST_NOTIFICATIONS not granted on API 33+)
        try {
            NotificationManagerCompat.from(context).notify(id.hashCode(), notification)
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS not granted — notification won't show
        }

        // Remove from SharedPreferences (alarm has fired, it's a one-shot)
        ReminderScheduler.removeReminder(context, id)
    }
}
