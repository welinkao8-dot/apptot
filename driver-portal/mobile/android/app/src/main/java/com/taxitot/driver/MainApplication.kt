package com.taxitot.driver

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.taxitot.driver.LocationPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here
          add(LocationPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    createTripOfferNotificationChannel()
    loadReactNative(this)
  }

  private fun createTripOfferNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        "trip_offers",
        "Pedidos de corrida",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Alertas de novas solicitações de corrida e entrega"
        enableVibration(true)
      }
      getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }
  }
}
