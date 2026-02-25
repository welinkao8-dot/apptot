package com.taxitot.driver;

import androidx.annotation.NonNull;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

public class MapboxNavigationViewManager extends SimpleViewManager<MapboxNavigationView> {

    public static final String REACT_CLASS = "MapboxNavigationView";

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected MapboxNavigationView createViewInstance(@NonNull ThemedReactContext reactContext) {
        return new MapboxNavigationView(reactContext);
    }

    @ReactProp(name = "mapStyle")
    public void setMapStyle(MapboxNavigationView view, String styleUri) {
        if (styleUri != null) {
            view.setStyle(styleUri);
        }
    }
}
