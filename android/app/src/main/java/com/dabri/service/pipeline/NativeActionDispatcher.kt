package com.dabri.service.pipeline

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsManager
import android.util.Log
import com.dabri.service.config.ServicePreferences
import com.dabri.reminder.ReminderScheduler
import java.util.UUID

data class ActionResult(
    val success: Boolean,
    val message: String
)

class NativeActionDispatcher(
    private val context: Context,
    private val preferences: ServicePreferences,
    private val contactResolver: ContactResolverNative,
    private val appResolver: AppNameResolverNative,
    private val timeParser: HebrewTimeParserNative
) {
    companion object {
        private const val TAG = "NativeActionDispatcher"
        private const val WAZE_PACKAGE = "com.waze"
        private const val GMAPS_PACKAGE = "com.google.android.apps.maps"
    }

    suspend fun dispatch(intent: ParsedIntent): ActionResult {
        Log.d(TAG, "Dispatching: ${intent.intent} (source: ${intent.source})")

        return try {
            when (intent.intent) {
                "MAKE_CALL" -> handleCall(intent)
                "SEND_SMS" -> handleSendSms(intent)
                "READ_SMS" -> handleReadSms(intent)
                "SEND_WHATSAPP" -> handleSendWhatsApp(intent)
                "SET_REMINDER" -> handleSetReminder(intent)
                "NAVIGATE" -> handleNavigate(intent)
                "OPEN_APP" -> handleOpenApp(intent)
                "READ_NOTIFICATIONS" -> ActionResult(true, "קריאת התראות זמינה רק מתוך האפליקציה")
                "READ_WHATSAPP" -> ActionResult(true, "קריאת וואטסאפ זמינה רק מתוך האפליקציה")
                else -> ActionResult(false, "לא הבנתי את הבקשה. נסה שוב.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Dispatch error", e)
            ActionResult(false, "אירעה שגיאה: ${e.message}")
        }
    }

    private fun handleCall(intent: ParsedIntent): ActionResult {
        val contactName = intent.contact ?: return ActionResult(false, "לא ציינת למי להתקשר")
        val aliases = preferences.getContactAliases()
        val contact = contactResolver.resolve(contactName, aliases)
            ?: return ActionResult(false, "לא מצאתי איש קשר בשם $contactName")

        val callIntent = Intent(Intent.ACTION_CALL).apply {
            data = Uri.parse("tel:${contact.phoneNumber}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(callIntent)
        return ActionResult(true, "מתקשר ל${contact.name}")
    }

    private fun handleSendSms(intent: ParsedIntent): ActionResult {
        val contactName = intent.contact ?: return ActionResult(false, "לא ציינת למי לשלוח")
        val message = intent.message ?: return ActionResult(false, "לא ציינת מה לשלוח")
        val aliases = preferences.getContactAliases()
        val contact = contactResolver.resolve(contactName, aliases)
            ?: return ActionResult(false, "לא מצאתי איש קשר בשם $contactName")

        try {
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(message)
            if (parts.size == 1) {
                smsManager.sendTextMessage(contact.phoneNumber, null, message, null, null)
            } else {
                smsManager.sendMultipartTextMessage(contact.phoneNumber, null, parts, null, null)
            }
            return ActionResult(true, "הודעה נשלחה ל${contact.name}")
        } catch (e: Exception) {
            return ActionResult(false, "שגיאה בשליחת ההודעה: ${e.message}")
        }
    }

    private fun handleReadSms(intent: ParsedIntent): ActionResult {
        val count = intent.count ?: 5
        val cursor = context.contentResolver.query(
            Telephony.Sms.Inbox.CONTENT_URI,
            arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
            null, null,
            "${Telephony.Sms.DATE} DESC"
        )

        val messages = mutableListOf<String>()
        cursor?.use { c ->
            val addressCol = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
            val bodyCol = c.getColumnIndexOrThrow(Telephony.Sms.BODY)
            var read = 0
            while (c.moveToNext() && read < count) {
                val address = c.getString(addressCol) ?: "לא ידוע"
                val body = c.getString(bodyCol) ?: ""
                messages.add("מ-$address: $body")
                read++
            }
        }

        return if (messages.isEmpty()) {
            ActionResult(true, "אין הודעות חדשות")
        } else {
            val response = "יש לך ${messages.size} הודעות. " +
                messages.joinToString(". הודעה הבאה: ")
            ActionResult(true, response)
        }
    }

    private fun handleSendWhatsApp(intent: ParsedIntent): ActionResult {
        val contactName = intent.contact ?: return ActionResult(false, "לא ציינת למי לשלוח")
        val message = intent.message ?: return ActionResult(false, "לא ציינת מה לשלוח")
        val aliases = preferences.getContactAliases()
        val contact = contactResolver.resolve(contactName, aliases)
            ?: return ActionResult(false, "לא מצאתי איש קשר בשם $contactName")

        // Format phone number for WhatsApp
        var phone = contact.phoneNumber.replace(Regex("[\\s-()]"), "")
        if (phone.startsWith("0")) {
            phone = "972${phone.substring(1)}"
        }

        val wpIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("https://wa.me/$phone?text=${Uri.encode(message)}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(wpIntent)
        return ActionResult(true, "שולח וואטסאפ ל${contact.name}")
    }

    private fun handleSetReminder(intent: ParsedIntent): ActionResult {
        val reminderText = intent.reminderText
            ?: return ActionResult(true, "תזכורות זמינות מתוך האפליקציה")

        val triggerTime = HebrewTimeParserNative.parse(intent.reminderTime)
        if (triggerTime == null) {
            // No time specified — set for 1 hour from now
            val defaultTime = System.currentTimeMillis() + 60 * 60 * 1000
            scheduleReminder(reminderText, defaultTime)
            return ActionResult(true, "תזכורת נקבעה: $reminderText (בעוד שעה)")
        }

        scheduleReminder(reminderText, triggerTime)
        return ActionResult(true, "תזכורת נקבעה: $reminderText")
    }

    private fun scheduleReminder(text: String, triggerTimeMs: Long) {
        val id = UUID.randomUUID().toString()
        ReminderScheduler.ensureChannel(context)
        ReminderScheduler.saveReminder(context, id, text, triggerTimeMs)
        ReminderScheduler.scheduleAlarm(context, id, text, triggerTimeMs)
    }

    private fun handleNavigate(intent: ParsedIntent): ActionResult {
        var destination = intent.destination
            ?: return ActionResult(false, "לא ציינת לאן לנווט")

        // Handle home/work shortcuts
        when {
            destination == "הביתה" || destination == "בית" -> {
                val home = preferences.homeAddress
                if (home.isNotBlank()) destination = home
            }
            destination == "עבודה" || destination == "לעבודה" -> {
                val work = preferences.workAddress
                if (work.isNotBlank()) destination = work
            }
        }

        val navApp = intent.navApp ?: preferences.preferredNavApp
        val navIntent = when (navApp) {
            "waze" -> {
                Intent(Intent.ACTION_VIEW, Uri.parse(
                    "https://waze.com/ul?q=${Uri.encode(destination)}&navigate=yes"
                ))
            }
            "google_maps" -> {
                Intent(Intent.ACTION_VIEW, Uri.parse(
                    "google.navigation:q=${Uri.encode(destination)}&mode=d"
                )).apply { setPackage(GMAPS_PACKAGE) }
            }
            else -> {
                Intent(Intent.ACTION_VIEW, Uri.parse(
                    "geo:0,0?q=${Uri.encode(destination)}"
                ))
            }
        }
        navIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(navIntent)
        return ActionResult(true, "מנווט ל$destination")
    }

    private fun handleOpenApp(intent: ParsedIntent): ActionResult {
        val appName = intent.appName ?: return ActionResult(false, "לא ציינת איזו אפליקציה לפתוח")
        val app = appResolver.resolve(appName)
            ?: return ActionResult(false, "לא מצאתי אפליקציה בשם $appName")

        val launchIntent = context.packageManager.getLaunchIntentForPackage(app.packageName)
            ?: return ActionResult(false, "לא ניתן לפתוח את ${app.label}")

        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launchIntent)
        return ActionResult(true, "פותח ${app.label}")
    }
}
