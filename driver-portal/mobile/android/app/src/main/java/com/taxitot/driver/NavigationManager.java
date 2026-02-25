package com.taxitot.driver;

import android.content.Context;
import com.mapbox.navigation.core.MapboxNavigation;
import com.mapbox.navigation.core.MapboxNavigationProvider;
import com.mapbox.navigation.base.options.NavigationOptions;

public class NavigationManager {

    private static MapboxNavigation instance;

    public static synchronized MapboxNavigation get(Context context) {
        if (instance == null) {
            instance = MapboxNavigationProvider.create(
                    new NavigationOptions.Builder(context.getApplicationContext()).build());
        }
        return instance;
    }

    public static synchronized void destroy() {
        if (instance != null) {
            MapboxNavigationProvider.destroy();
            instance = null;
        }
    }
}
