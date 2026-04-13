package com.dabri.service.config

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log

object OemBatteryGuide {

    private const val TAG = "OemBatteryGuide"

    fun getManufacturer(): String = Build.MANUFACTURER.lowercase()

    fun isSamsung(): Boolean = Build.MANUFACTURER.equals("samsung", ignoreCase = true)
    fun isXiaomi(): Boolean = Build.MANUFACTURER.equals("xiaomi", ignoreCase = true)
    fun isHuawei(): Boolean = Build.MANUFACTURER.equals("huawei", ignoreCase = true)

    fun openBatterySettings(context: Context): Boolean {
        return when {
            isSamsung() -> openSamsungBatterySettings(context)
            isXiaomi() -> openXiaomiAutoStart(context)
            isHuawei() -> openHuaweiProtectedApps(context)
            else -> openGenericBatterySettings(context)
        }
    }

    private fun openSamsungBatterySettings(context: Context): Boolean {
        // Try Samsung-specific battery activity
        val intents = listOf(
            Intent().apply {
                component = ComponentName(
                    "com.samsung.android.lool",
                    "com.samsung.android.sm.battery.ui.BatteryActivity"
                )
            },
            Intent().apply {
                component = ComponentName(
                    "com.samsung.android.lool",
                    "com.samsung.android.sm.battery.ui.usage.AppSleepSettingActivity"
                )
            }
        )

        for (intent in intents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                return true
            } catch (_: Exception) {
                continue
            }
        }

        return openGenericBatterySettings(context)
    }

    private fun openXiaomiAutoStart(context: Context): Boolean {
        try {
            val intent = Intent().apply {
                component = ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity"
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            return true
        } catch (_: Exception) {
            return openGenericBatterySettings(context)
        }
    }

    private fun openHuaweiProtectedApps(context: Context): Boolean {
        try {
            val intent = Intent().apply {
                component = ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            return true
        } catch (_: Exception) {
            return openGenericBatterySettings(context)
        }
    }

    private fun openGenericBatterySettings(context: Context): Boolean {
        return try {
            val intent = Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open battery settings", e)
            false
        }
    }
}
