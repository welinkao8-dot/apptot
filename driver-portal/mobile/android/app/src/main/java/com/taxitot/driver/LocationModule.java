package com.taxitot.driver;

import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

public class LocationModule extends ReactContextBaseJavaModule {
    private static final String TAG = "LocationModule";
    private final ReactApplicationContext context;

    public LocationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.context = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "LocationModule";
    }

    @ReactMethod
    public void startLocationUpdates() {
        Log.d(TAG, "Starting location service updates");
        Intent intent = new Intent(context, LocationService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, intent);
        } else {
            context.startService(intent);
        }
    }

    @ReactMethod
    public void stopLocationUpdates() {
        Log.d(TAG, "Stopping location service updates");
        Intent intent = new Intent(context, LocationService.class);
        context.stopService(intent);
    }

    @ReactMethod
    public void configureLocationUpload(String apiBaseUrl, String token, Promise promise) {
        try {
            LocationService.configureUpload(apiBaseUrl, token);
            promise.resolve(true);
        } catch (IllegalArgumentException error) {
            promise.reject("LOCATION_CONFIG_INVALID", error.getMessage());
        }
    }

    @ReactMethod
    public void clearLocationUploadConfig(Promise promise) {
        LocationService.clearUploadConfig();
        promise.resolve(true);
    }

    @ReactMethod
    public void getLatestLocation(Promise promise) {
        LocationService service = LocationService.getInstance();
        Location location = service == null ? null : service.getLatestLocation();
        if (location == null) {
            promise.resolve(null);
            return;
        }

        WritableMap params = Arguments.createMap();
        WritableMap coords = Arguments.createMap();
        coords.putDouble("latitude", location.getLatitude());
        coords.putDouble("longitude", location.getLongitude());
        coords.putDouble("accuracy", location.getAccuracy());
        coords.putDouble("speed", location.getSpeed());
        coords.putDouble("heading", location.getBearing());
        coords.putDouble("timestamp", location.getTime());
        params.putMap("coords", coords);
        promise.resolve(params);
    }
}
