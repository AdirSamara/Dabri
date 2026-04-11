package com.dabri.sms

import android.os.Build
import android.provider.Telephony
import android.telephony.SmsManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = SmsModule.NAME)
class SmsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "SmsModule"
    }

    override fun getName(): String = NAME

    /**
     * Read up to [maxCount] messages from the SMS inbox, ordered newest first.
     * Resolves with a ReadableArray of maps: {id, address, body, date}.
     */
    @ReactMethod
    fun readInbox(maxCount: Int, promise: Promise) {
        try {
            val uri = Telephony.Sms.Inbox.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
            )

            val cursor = reactContext.contentResolver.query(
                uri,
                projection,
                null,
                null,
                "${Telephony.Sms.DATE} DESC",
            )

            val result = Arguments.createArray()

            cursor?.use { c ->
                val idCol = c.getColumnIndexOrThrow(Telephony.Sms._ID)
                val addressCol = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyCol = c.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateCol = c.getColumnIndexOrThrow(Telephony.Sms.DATE)

                var count = 0
                while (c.moveToNext() && count < maxCount) {
                    val map = Arguments.createMap()
                    map.putString("id", c.getString(idCol))
                    map.putString("address", c.getString(addressCol) ?: "")
                    map.putString("body", c.getString(bodyCol) ?: "")
                    map.putDouble("date", c.getLong(dateCol).toDouble())
                    result.pushMap(map)
                    count++
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("READ_SMS_ERROR", e.message ?: "Failed to read SMS inbox", e)
        }
    }

    /**
     * Send an SMS to [phoneNumber] with [message].
     * Resolves with true on success.
     */
    @ReactMethod
    fun sendSms(phoneNumber: String, message: String, promise: Promise) {
        try {
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                reactContext.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            // Split into multiple parts if the message exceeds a single SMS limit
            val parts = smsManager.divideMessage(message)
            if (parts.size == 1) {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null)
            } else {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SEND_SMS_ERROR", e.message ?: "Failed to send SMS", e)
        }
    }
}
