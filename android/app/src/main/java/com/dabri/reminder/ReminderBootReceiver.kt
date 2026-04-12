package com.dabri.reminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReminderBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        // Ensure notification channel exists after reboot
        ReminderScheduler.ensureChannel(context)

        val reminders = ReminderScheduler.getAllReminders(context)
        val now = System.currentTimeMillis()

        for (reminder in reminders) {
            if (reminder.triggerTimeMs > now) {
                // Future reminder — re-schedule the alarm
                ReminderScheduler.scheduleAlarm(
                    context, reminder.id, reminder.text, reminder.triggerTimeMs
                )
            } else {
                // Missed reminder (alarm was supposed to fire while device was off)
                // Fire the notification immediately by sending a broadcast to the alarm receiver
                val alarmIntent = Intent(context, ReminderAlarmReceiver::class.java).apply {
                    putExtra(ReminderScheduler.EXTRA_REMINDER_ID, reminder.id)
                    putExtra(ReminderScheduler.EXTRA_REMINDER_TEXT, reminder.text)
                }
                context.sendBroadcast(alarmIntent)
            }
        }
    }
}
