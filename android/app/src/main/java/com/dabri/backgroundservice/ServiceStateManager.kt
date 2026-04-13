package com.dabri.backgroundservice

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

object ServiceStateManager {
    const val PREFS_NAME = "dabri_service_prefs"
    private const val KEY_ENABLED = "service_enabled"
    private const val KEY_WAKE_WORD_ENABLED = "wake_word_enabled"
    private const val KEY_WAKE_WORD_PHRASE = "wake_word_phrase"
    private const val DEFAULT_WAKE_PHRASE = "היי דברי"

    fun setEnabled(context: Context, enabled: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    fun wasEnabled(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_ENABLED, false)
    }

    fun setWakeWordConfig(context: Context, enabled: Boolean, phrase: String) {
        getPrefs(context).edit()
            .putBoolean(KEY_WAKE_WORD_ENABLED, enabled)
            .putString(KEY_WAKE_WORD_PHRASE, phrase)
            .apply()
    }

    fun isWakeWordEnabled(context: Context): Boolean =
        getPrefs(context).getBoolean(KEY_WAKE_WORD_ENABLED, false)

    fun getWakeWordPhrase(context: Context): String =
        getPrefs(context).getString(KEY_WAKE_WORD_PHRASE, DEFAULT_WAKE_PHRASE) ?: DEFAULT_WAKE_PHRASE

    fun emitToJS(reactContext: ReactContext?, eventName: String, state: String) {
        try {
            val data = Arguments.createMap().apply {
                putString("state", state)
            }
            reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, data)
        } catch (_: Exception) {
            // JS bridge not ready — safe to ignore
        }
    }

    private fun getPrefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
