package com.drivermobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.drivermobile.MapboxNavigationPackage
import com.mapbox.navigation.core.lifecycle.MapboxNavigationApp
import com.mapbox.navigation.base.options.NavigationOptions

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(MapboxNavigationPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    if (!MapboxNavigationApp.isSetup()) {
        MapboxNavigationApp.setup(
            NavigationOptions.Builder(this)
                .build()
        )
    }
    loadReactNative(this)
  }
}
