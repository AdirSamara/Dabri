package com.dabri

import android.app.Application
import com.dabri.assistant.AssistantPackage
import com.dabri.phone.PhonePackage
import com.dabri.reminder.ReminderPackage
import com.dabri.applauncher.AppLauncherPackage
import com.dabri.sms.SmsPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(SmsPackage())
          add(PhonePackage())
          add(AssistantPackage())
          add(ReminderPackage())
          add(AppLauncherPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
