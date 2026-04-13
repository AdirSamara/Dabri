package com.dabri.service.config

import android.content.Context
import org.json.JSONObject

class ServicePreferences(context: Context) {

    companion object {
        const val PREFS_NAME = "dabri_service_prefs"
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    var serviceEnabled: Boolean
        get() = prefs.getBoolean("service_enabled", false)
        set(value) = prefs.edit().putBoolean("service_enabled", value).apply()

    var geminiApiKey: String
        get() = prefs.getString("gemini_api_key", "") ?: ""
        set(value) = prefs.edit().putString("gemini_api_key", value).apply()

    var preferredNavApp: String
        get() = prefs.getString("preferred_nav_app", "waze") ?: "waze"
        set(value) = prefs.edit().putString("preferred_nav_app", value).apply()

    var homeAddress: String
        get() = prefs.getString("home_address", "") ?: ""
        set(value) = prefs.edit().putString("home_address", value).apply()

    var workAddress: String
        get() = prefs.getString("work_address", "") ?: ""
        set(value) = prefs.edit().putString("work_address", value).apply()

    var ttsSpeed: Float
        get() = prefs.getFloat("tts_speed", 0.9f)
        set(value) = prefs.edit().putFloat("tts_speed", value).apply()

    var silenceTimeout: Long
        get() = prefs.getLong("silence_timeout", 1000L)
        set(value) = prefs.edit().putLong("silence_timeout", value).apply()

    var wakeWordSensitivity: Float
        get() = prefs.getFloat("wake_word_sensitivity", 0.5f)
        set(value) = prefs.edit().putFloat("wake_word_sensitivity", value).apply()

    var autoStartOnBoot: Boolean
        get() = prefs.getBoolean("auto_start_on_boot", false)
        set(value) = prefs.edit().putBoolean("auto_start_on_boot", value).apply()

    var showOnLockScreen: Boolean
        get() = prefs.getBoolean("show_on_lock_screen", false)
        set(value) = prefs.edit().putBoolean("show_on_lock_screen", value).apply()

    var bubbleEnabled: Boolean
        get() = prefs.getBoolean("bubble_enabled", true)
        set(value) = prefs.edit().putBoolean("bubble_enabled", value).apply()

    var isDarkMode: Boolean
        get() = prefs.getBoolean("is_dark_mode", false)
        set(value) = prefs.edit().putBoolean("is_dark_mode", value).apply()

    var bubbleX: Int
        get() = prefs.getInt("bubble_x", -1)
        set(value) = prefs.edit().putInt("bubble_x", value).apply()

    var bubbleY: Int
        get() = prefs.getInt("bubble_y", -1)
        set(value) = prefs.edit().putInt("bubble_y", value).apply()

    fun getContactAliases(): Map<String, String> {
        val json = prefs.getString("contact_aliases", "{}") ?: "{}"
        return try {
            val obj = JSONObject(json)
            val map = mutableMapOf<String, String>()
            obj.keys().forEach { key -> map[key] = obj.getString(key) }
            map
        } catch (_: Exception) {
            emptyMap()
        }
    }

    fun setContactAliases(aliases: Map<String, String>) {
        val obj = JSONObject()
        aliases.forEach { (key, value) -> obj.put(key, value) }
        prefs.edit().putString("contact_aliases", obj.toString()).apply()
    }
}
