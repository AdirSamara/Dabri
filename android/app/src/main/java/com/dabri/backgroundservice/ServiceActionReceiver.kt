package com.dabri.backgroundservice

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class ServiceActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_PAUSE = "com.dabri.ACTION_SERVICE_PAUSE"
        const val ACTION_RESUME = "com.dabri.ACTION_SERVICE_RESUME"
        const val ACTION_STOP = "com.dabri.ACTION_SERVICE_STOP"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val serviceIntent = Intent(context, DabriFloatingService::class.java)

        when (intent.action) {
            ACTION_PAUSE -> {
                serviceIntent.action = DabriFloatingService.ACTION_PAUSE
                context.startService(serviceIntent)
            }
            ACTION_RESUME -> {
                serviceIntent.action = DabriFloatingService.ACTION_RESUME
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            }
            ACTION_STOP -> {
                serviceIntent.action = DabriFloatingService.ACTION_STOP
                context.startService(serviceIntent)
            }
        }
    }
}
