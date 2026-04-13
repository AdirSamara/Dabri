package com.dabri.navigation

import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NavigationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NavigationBridge"

    companion object {
        private const val WAZE_PACKAGE = "com.waze"
        private const val GMAPS_PACKAGE = "com.google.android.apps.maps"
    }

    @ReactMethod
    fun isAppInstalled(packageName: String, promise: Promise) {
        try {
            reactContext.packageManager.getPackageInfo(packageName, 0)
            promise.resolve(true)
        } catch (e: PackageManager.NameNotFoundException) {
            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun navigateWithWaze(destination: String, promise: Promise) {
        try {
            val url = "https://waze.com/ul?q=${Uri.encode(destination)}&navigate=yes"
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve("waze")
        } catch (e: ActivityNotFoundException) {
            promise.reject("WAZE_NOT_FOUND", "Waze is not installed", e)
        } catch (e: Exception) {
            promise.reject("NAV_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun navigateWithWazeFavorite(favorite: String, promise: Promise) {
        try {
            val url = "https://waze.com/ul?favorite=${Uri.encode(favorite)}&navigate=yes"
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve("waze")
        } catch (e: ActivityNotFoundException) {
            promise.reject("WAZE_NOT_FOUND", "Waze is not installed", e)
        } catch (e: Exception) {
            promise.reject("NAV_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun navigateWithGoogleMaps(destination: String, promise: Promise) {
        try {
            val uri = Uri.parse("google.navigation:q=${Uri.encode(destination)}&mode=d")
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage(GMAPS_PACKAGE)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve("google_maps")
        } catch (e: ActivityNotFoundException) {
            promise.reject("GMAPS_NOT_FOUND", "Google Maps is not installed", e)
        } catch (e: Exception) {
            promise.reject("NAV_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun navigateWithGeo(destination: String, promise: Promise) {
        try {
            val uri = Uri.parse("geo:0,0?q=${Uri.encode(destination)}")
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve("geo")
        } catch (e: ActivityNotFoundException) {
            promise.reject("GEO_NOT_FOUND", "No navigation app found", e)
        } catch (e: Exception) {
            promise.reject("NAV_ERROR", e.message, e)
        }
    }
}
