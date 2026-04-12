package com.dabri.reminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

class ReminderActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(ReminderScheduler.EXTRA_REMINDER_ID) ?: return

        when (intent.action) {
            ReminderScheduler.ACTION_DISMISS -> {
                // Cancel the notification
                NotificationManagerCompat.from(context).cancel(id.hashCode())
                // Remove from SharedPreferences
                ReminderScheduler.removeReminder(context, id)
            }

            ReminderScheduler.ACTION_SNOOZE -> {
                val text = intent.getStringExtra(ReminderScheduler.EXTRA_REMINDER_TEXT) ?: return

                // Cancel current notification
                NotificationManagerCompat.from(context).cancel(id.hashCode())

                // Reschedule +10 minutes
                val newTriggerTime = System.currentTimeMillis() + (10 * 60 * 1000L)

                // Save updated trigger time and re-schedule alarm
                ReminderScheduler.saveReminder(context, id, text, newTriggerTime)
                ReminderScheduler.scheduleAlarm(context, id, text, newTriggerTime)
            }
        }
    }
}
