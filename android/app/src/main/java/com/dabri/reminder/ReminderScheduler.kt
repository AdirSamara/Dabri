package com.dabri.reminder

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

data class ReminderData(val id: String, val text: String, val triggerTimeMs: Long)

object ReminderScheduler {
    const val CHANNEL_ID = "dabri_reminders"
    const val CHANNEL_NAME = "תזכורות מדברי"
    const val CHANNEL_DESCRIPTION = "התראות תזכורת מאפליקציית דברי"
    const val PREFS_NAME = "dabri_reminders"
    const val PREFS_KEY_PREFIX = "reminder_"

    const val EXTRA_REMINDER_ID = "reminder_id"
    const val EXTRA_REMINDER_TEXT = "reminder_text"

    const val ACTION_DISMISS = "com.dabri.ACTION_DISMISS"
    const val ACTION_SNOOZE = "com.dabri.ACTION_SNOOZE"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableVibration(true)
                enableLights(true)
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    fun scheduleAlarm(context: Context, id: String, text: String, triggerTimeMs: Long) {
        val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            putExtra(EXTRA_REMINDER_ID, id)
            putExtra(EXTRA_REMINDER_TEXT, text)
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_IMMUTABLE else 0

        val pendingIntent = PendingIntent.getBroadcast(
            context, id.hashCode(), intent, flags
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            // Fallback: inexact but Doze-aware (may drift up to ~10 min)
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP, triggerTimeMs, pendingIntent
            )
        } else {
            // Exact alarm — works on API 24-30 without permission, API 31+ with permission
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP, triggerTimeMs, pendingIntent
            )
        }
    }

    fun cancelAlarm(context: Context, id: String) {
        val intent = Intent(context, ReminderAlarmReceiver::class.java)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_IMMUTABLE else 0

        val pendingIntent = PendingIntent.getBroadcast(
            context, id.hashCode(), intent, flags
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(pendingIntent)

        // Also cancel any showing notification
        NotificationManagerCompat.from(context).cancel(id.hashCode())
    }

    fun saveReminder(context: Context, id: String, text: String, triggerTimeMs: Long) {
        val json = JSONObject().apply {
            put("id", id)
            put("text", text)
            put("triggerTimeMs", triggerTimeMs)
        }
        getPrefs(context).edit()
            .putString("$PREFS_KEY_PREFIX$id", json.toString())
            .apply()
    }

    fun removeReminder(context: Context, id: String) {
        getPrefs(context).edit()
            .remove("$PREFS_KEY_PREFIX$id")
            .apply()
    }

    fun getAllReminders(context: Context): List<ReminderData> {
        val prefs = getPrefs(context)
        val reminders = mutableListOf<ReminderData>()

        prefs.all.forEach { (key, value) ->
            if (key.startsWith(PREFS_KEY_PREFIX) && value is String) {
                try {
                    val json = JSONObject(value)
                    reminders.add(
                        ReminderData(
                            id = json.getString("id"),
                            text = json.getString("text"),
                            triggerTimeMs = json.getLong("triggerTimeMs")
                        )
                    )
                } catch (_: Exception) {
                    // Skip malformed entries
                }
            }
        }

        return reminders
    }

    private fun getPrefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
