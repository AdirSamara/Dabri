package com.dabri.applauncher

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.CalendarContract
import android.provider.MediaStore
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppLauncherModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppLauncherBridge"

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val mainIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val activities = pm.queryIntentActivities(mainIntent, 0)

            val selfPackage = reactContext.packageName
            val apps = activities
                .mapNotNull { ri ->
                    val pkg = ri.activityInfo.packageName
                    if (pkg == selfPackage) return@mapNotNull null
                    val label = ri.loadLabel(pm).toString()
                    Pair(pkg, label)
                }
                .distinctBy { it.first }
                .sortedBy { it.second.lowercase() }

            val result = Arguments.createArray()
            for ((pkg, label) in apps) {
                val map = Arguments.createMap()
                map.putString("packageName", pkg)
                map.putString("label", label)
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_APPS_ERROR", e.message ?: "Failed to get installed apps", e)
        }
    }

    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        try {
            val intent = reactContext.packageManager.getLaunchIntentForPackage(packageName)
            if (intent == null) {
                promise.reject("APP_NOT_LAUNCHABLE", "Cannot launch app: $packageName")
                return
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: ActivityNotFoundException) {
            promise.reject("LAUNCH_ERROR", "App not found: $packageName", e)
        } catch (e: Exception) {
            promise.reject("LAUNCH_ERROR", e.message ?: "Failed to launch app", e)
        }
    }

    @ReactMethod
    fun launchByCategory(category: String, promise: Promise) {
        try {
            val intent = when (category) {
                "camera" -> Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                "settings" -> Intent(Settings.ACTION_SETTINGS)
                "browser" -> Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com"))
                "playstore" -> Intent(Intent.ACTION_VIEW, Uri.parse("market://search?q="))
                "calendar" -> Intent(Intent.ACTION_VIEW).apply {
                    data = CalendarContract.CONTENT_URI
                }
                "calculator" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        Intent(Intent.ACTION_MAIN).apply {
                            addCategory(Intent.CATEGORY_APP_CALCULATOR)
                        }
                    } else {
                        // Fallback: try known calculator packages
                        val calcIntent = reactContext.packageManager
                            .getLaunchIntentForPackage("com.google.android.calculator")
                            ?: reactContext.packageManager
                                .getLaunchIntentForPackage("com.sec.android.app.popupcalculator")
                        if (calcIntent != null) {
                            calcIntent
                        } else {
                            promise.reject("CATEGORY_NOT_FOUND", "Calculator app not found")
                            return
                        }
                    }
                }
                else -> {
                    promise.reject("UNKNOWN_CATEGORY", "Unknown category: $category")
                    return
                }
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: ActivityNotFoundException) {
            promise.reject("CATEGORY_LAUNCH_ERROR", "No app found for category: $category", e)
        } catch (e: Exception) {
            promise.reject("CATEGORY_LAUNCH_ERROR", e.message ?: "Failed to launch category", e)
        }
    }
}
