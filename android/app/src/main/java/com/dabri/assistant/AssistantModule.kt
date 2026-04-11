package com.dabri.assistant

import android.app.role.RoleManager
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.dabri.MainActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AssistantModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AssistantModule"

  @ReactMethod
  fun isDefaultAssistant(promise: Promise) {
    try {
      val isDefault = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val roleManager = reactContext.getSystemService(RoleManager::class.java)
        roleManager?.isRoleHeld(RoleManager.ROLE_ASSISTANT) ?: false
      } else {
        // Fallback for API < 29
        val assistant = Settings.Secure.getString(
          reactContext.contentResolver,
          "assistant"
        )
        assistant?.contains("com.dabri") ?: false
      }
      promise.resolve(isDefault)
    } catch (e: Exception) {
      promise.reject("ASSISTANT_CHECK_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun openAssistantSettings(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "currentActivity is null")
      return
    }

    val handler = android.os.Handler(android.os.Looper.getMainLooper())
    handler.post {
      // 1. RoleManager — must use startActivityForResult, not startActivity
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        try {
          val roleManager = reactContext.getSystemService(RoleManager::class.java)
          val intent = roleManager?.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT)
          if (intent != null) {
            activity.startActivityForResult(intent, 0)
            promise.resolve(null)
            return@post
          }
        } catch (e: Exception) {
          // Fall through
        }
      }

      // 2. Samsung One UI — specific component
      try {
        val intent = Intent().apply {
          component = android.content.ComponentName(
            "com.android.settings",
            "com.android.settings.Settings\$DefaultAssistActivity"
          )
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
        promise.resolve(null)
        return@post
      } catch (e: Exception) {
        // Fall through
      }

      // 3. ACTION_MANAGE_DEFAULT_APPS_SETTINGS
      try {
        val intent = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
        promise.resolve(null)
        return@post
      } catch (e: Exception) {
        // Fall through
      }

      // 4. Last resort — open main Settings
      try {
        val intent = Intent(Settings.ACTION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ALL_FAILED", e.message, e)
      }
    }
  }

  @ReactMethod
  fun wasLaunchedFromAssist(promise: Promise) {
    val wasLaunchedFromAssist = MainActivity.launchedFromAssist
    MainActivity.launchedFromAssist = false
    promise.resolve(wasLaunchedFromAssist)
  }
}
