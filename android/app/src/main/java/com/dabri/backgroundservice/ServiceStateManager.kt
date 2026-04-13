package com.dabri.backgroundservice

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

object ServiceStateManager {
    const val PREFS_NAME = "dabri_service_prefs"
    private const val KEY_ENABLED = "service_enabled"

    fun setEnabled(context: Context, enabled: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    fun wasEnabled(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_ENABLED, false)
    }

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
