package com.paasora.partner

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
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
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannels()
    loadReactNative(this)
  }

  // Push notifications are posted by the FCM SDK before any JS runs, so the
  // channels have to exist natively. The ids are the ones the backend sends
  // (push-channels.ts); an unknown id falls back to `general` via firebase.json.
  // Re-creating an existing channel only refreshes its name, never the
  // importance the user may have changed in settings.
  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    manager.createNotificationChannels(
      listOf(
        NotificationChannel("new_orders", getString(R.string.channel_new_orders), NotificationManager.IMPORTANCE_HIGH),
        NotificationChannel("orders", getString(R.string.channel_orders), NotificationManager.IMPORTANCE_HIGH),
        NotificationChannel("account", getString(R.string.channel_account), NotificationManager.IMPORTANCE_DEFAULT),
        NotificationChannel("general", getString(R.string.channel_general), NotificationManager.IMPORTANCE_DEFAULT),
      ),
    )
  }
}
