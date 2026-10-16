package com.taxitot.driver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class LocationService extends Service implements LocationListener {
    private static final String TAG = "LocationService";
    private static final String CHANNEL_ID = "location_service_channel";
    private LocationManager locationManager;
    private static LocationService instance;
    private static volatile String uploadUrl;
    private static volatile String uploadToken;
    private final ExecutorService uploadExecutor = Executors.newSingleThreadExecutor();
    private final AtomicReference<Location> pendingUpload = new AtomicReference<>();
    private final AtomicBoolean uploadRunning = new AtomicBoolean(false);
    private Location latestLocation;

    public static void configureUpload(String apiBaseUrl, String token) {
        if (apiBaseUrl == null || token == null || token.trim().isEmpty()) {
            throw new IllegalArgumentException("URL da API e sessão autenticada são obrigatórias.");
        }
        String normalizedBaseUrl = apiBaseUrl.trim().replaceAll("/+$", "");
        if (!normalizedBaseUrl.matches("^https?://[^\\s]+$")) {
            throw new IllegalArgumentException("URL da API inválida.");
        }
        uploadUrl = normalizedBaseUrl + "/trips/location";
        uploadToken = token;
    }

    public static void clearUploadConfig() {
        uploadUrl = null;
        uploadToken = null;
    }

    public static LocationService getInstance() {
        return instance;
    }

    public synchronized Location getLatestLocation() {
        return latestLocation == null ? null : new Location(latestLocation);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("TOT Driver Ativo")
                .setContentText("Acompanhando a sua localização em segundo plano")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .build();

        startForeground(2, notification);

        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        startTracking();
    }

    private void startTracking() {
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        5000, // 5 seconds
                        5,    // 5 meters
                        this
                );
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        5000,
                        5,
                        this
                );
            }
        } catch (SecurityException e) {
            Log.e(TAG, "No permission to track location", e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (uploadUrl == null || uploadToken == null) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        uploadExecutor.shutdownNow();
        instance = null;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onLocationChanged(Location location) {
        synchronized (this) {
            latestLocation = new Location(location);
        }
        enqueueLocationUpload(location);
        WritableMap params = Arguments.createMap();
        WritableMap coords = Arguments.createMap();
        coords.putDouble("latitude", location.getLatitude());
        coords.putDouble("longitude", location.getLongitude());
        coords.putDouble("accuracy", location.getAccuracy());
        coords.putDouble("speed", location.getSpeed());
        coords.putDouble("heading", location.getBearing());
        coords.putDouble("timestamp", location.getTime());
        params.putMap("coords", coords);

        MainApplication app = (MainApplication) getApplication();
        if (app != null && app.getReactHost() != null) {
            try {
                com.facebook.react.bridge.ReactContext reactContext = app.getReactHost().getCurrentReactContext();
                if (reactContext != null) {
                    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                            .emit("onLocationUpdate", params);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error emitting location event", e);
            }
        }
    }

    private void enqueueLocationUpload(Location location) {
        if (uploadUrl == null || uploadToken == null || !location.hasAccuracy() || location.getAccuracy() < 0 || location.getAccuracy() > 100) return;
        if (Math.abs(System.currentTimeMillis() - location.getTime()) > 120_000) return;
        pendingUpload.set(new Location(location));
        if (uploadRunning.compareAndSet(false, true)) {
            uploadExecutor.execute(() -> {
                try {
                    Location next;
                    while ((next = pendingUpload.getAndSet(null)) != null) uploadLocation(next);
                } finally {
                    uploadRunning.set(false);
                    if (pendingUpload.get() != null && uploadRunning.compareAndSet(false, true)) {
                        uploadExecutor.execute(this::drainPendingUploads);
                    }
                }
            });
        }
    }

    private void drainPendingUploads() {
        try {
            Location next;
            while ((next = pendingUpload.getAndSet(null)) != null) uploadLocation(next);
        } finally {
            uploadRunning.set(false);
            if (pendingUpload.get() != null && uploadRunning.compareAndSet(false, true)) {
                uploadExecutor.execute(this::drainPendingUploads);
            }
        }
    }

    private void uploadLocation(Location location) {
        String endpoint = uploadUrl;
        String token = uploadToken;
        if (endpoint == null || token == null) return;
        HttpURLConnection connection = null;
        try {
            URL url = new URL(endpoint);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(3000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            JSONObject payload = new JSONObject();
            payload.put("lat", location.getLatitude());
            payload.put("lng", location.getLongitude());
            payload.put("accuracy", location.getAccuracy());
            payload.put("heading", location.getBearing() % 360f);
            payload.put("timestamp", location.getTime());
            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) Log.w(TAG, "Location upload rejected with HTTP " + status);
        } catch (Exception error) {
            Log.w(TAG, "Location upload failed; next GPS fix will retry", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Localização em Segundo Plano",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }
}
