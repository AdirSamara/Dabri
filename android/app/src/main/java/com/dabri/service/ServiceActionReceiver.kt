package com.dabri.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ServiceActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_STOP = "com.dabri.service.ACTION_STOP"
        const val ACTION_TOGGLE_LISTENING = "com.dabri.service.ACTION_TOGGLE_LISTENING"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_STOP -> {
                DabriVoiceService.stop(context)
            }
            ACTION_TOGGLE_LISTENING -> {
                val serviceIntent = Intent(context, DabriVoiceService::class.java).apply {
                    action = DabriVoiceService.ACTION_TOGGLE_LISTENING
                }
                context.startService(serviceIntent)
            }
        }
    }
}
