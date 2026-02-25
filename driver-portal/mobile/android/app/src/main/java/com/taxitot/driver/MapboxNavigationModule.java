package com.taxitot.driver;

import android.content.Intent;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.mapbox.common.location.Location;
import android.os.Build;

import com.mapbox.api.directions.v5.DirectionsCriteria;
import com.mapbox.api.directions.v5.models.RouteOptions;
import com.mapbox.bindgen.Expected;

import com.mapbox.geojson.Point;

import com.mapbox.navigation.base.route.NavigationRoute;
import com.mapbox.navigation.base.route.NavigationRouterCallback;
import com.mapbox.navigation.base.route.RouterFailure;
import com.mapbox.navigation.base.route.RouterOrigin;
import com.mapbox.navigation.base.trip.model.RouteLegProgress;
import com.mapbox.navigation.base.trip.model.RouteProgress;

import com.mapbox.navigation.core.MapboxNavigation;
import com.mapbox.navigation.core.arrival.ArrivalObserver;
import com.mapbox.navigation.core.trip.session.LocationObserver;
import com.mapbox.navigation.core.trip.session.LocationMatcherResult;
import com.mapbox.navigation.core.trip.session.RouteProgressObserver;
import com.mapbox.navigation.core.trip.session.VoiceInstructionsObserver;

import com.mapbox.navigation.tripdata.maneuver.api.MapboxManeuverApi;
import com.mapbox.navigation.tripdata.maneuver.model.Maneuver;
import com.mapbox.navigation.tripdata.maneuver.model.ManeuverError;

// **Imports para formatação de distância (v3.18.1)**
import com.mapbox.navigation.core.formatter.MapboxDistanceFormatter;
import com.mapbox.navigation.base.formatter.DistanceFormatterOptions;

import com.mapbox.navigation.voice.api.MapboxSpeechApi;
import com.mapbox.navigation.voice.api.MapboxVoiceInstructionsPlayer;
import com.mapbox.navigation.voice.model.SpeechAnnouncement;
import com.mapbox.navigation.voice.model.SpeechError;
import com.mapbox.navigation.voice.model.SpeechValue;
import com.mapbox.navigation.voice.model.SpeechVolume;
import com.mapbox.navigation.voice.options.MapboxSpeechApiOptions;
import com.mapbox.navigation.voice.options.VoiceInstructionsPlayerOptions;
import com.mapbox.navigation.ui.base.util.MapboxNavigationConsumer;
import com.mapbox.navigation.core.directions.session.RoutesObserver;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MapboxNavigationModule extends ReactContextBaseJavaModule {

    private static final String TAG = "MapboxNavModule";
    private final ReactApplicationContext context;
    private boolean isMuted = false;
    private boolean isTripSessionActive = false;

    private MapboxManeuverApi maneuverApi;
    private MapboxSpeechApi speechApi;
    private MapboxVoiceInstructionsPlayer voicePlayer;
    private LocationObserver uberLocationObserver;

    public MapboxNavigationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.context = reactContext;

        // PT-BR Locale logic
        String languageTag = new Locale("pt", "BR").toLanguageTag();
        DistanceFormatterOptions options = new DistanceFormatterOptions.Builder(context)
                .locale(new Locale("pt", "BR"))
                .build();

        maneuverApi = new MapboxManeuverApi(new MapboxDistanceFormatter(options));
        
        // Final Alignment with v3 Builders (Fixing no-arg and 3-arg signatures)
        // languageTag is passed to the constructor, not the builder in this version
        MapboxSpeechApiOptions speechOptions = new MapboxSpeechApiOptions.Builder()
                .build();
        speechApi = new MapboxSpeechApi(context, languageTag, speechOptions);

        VoiceInstructionsPlayerOptions voiceOptions = new VoiceInstructionsPlayerOptions.Builder()
                .build();
        voicePlayer = new MapboxVoiceInstructionsPlayer(context, languageTag, voiceOptions);
    }

    @NonNull
    @Override
    public String getName() {
        return "MapboxNavigationModule";
    }

    private final RouteProgressObserver routeProgressObserver = progress -> {
        if (maneuverApi == null)
            return;
        Expected<ManeuverError, List<Maneuver>> result = maneuverApi.getManeuvers(progress);
        if (result.isValue()) {
            sendNavigationProgress(progress, result.getValue());
        }
    };

    // Official Callback: Clean up speech announcement after playing
    private final MapboxNavigationConsumer<SpeechAnnouncement> voiceInstructionsPlayerCallback = announcement -> {
        if (speechApi != null) {
            speechApi.clean(announcement);
        }
    };

    // Official Callback: Handle generated audio from Speech API
    private final MapboxNavigationConsumer<Expected<SpeechError, SpeechValue>> speechCallback = expected -> {
        if (voicePlayer == null)
            return;
        if (expected.isValue()) {
            voicePlayer.play(expected.getValue().getAnnouncement(), voiceInstructionsPlayerCallback);
        } else {
            voicePlayer.play(expected.getError().getFallback(), voiceInstructionsPlayerCallback);
        }
    };

    private final VoiceInstructionsObserver voiceObserver = voiceInstructions -> {
        if (speechApi != null && !isMuted) {
            speechApi.generate(voiceInstructions, speechCallback);
        }
    };

    private final ArrivalObserver arrivalObserver = new ArrivalObserver() {
        @Override
        public void onNextRouteLegStart(@NonNull RouteLegProgress routeLegProgress) {
        }

        @Override
        public void onFinalDestinationArrival(@NonNull RouteProgress routeProgress) {
            WritableMap map = Arguments.createMap();
            map.putBoolean("arrived", true);
            map.putBoolean("finalDestination", true);
            sendEvent("onArrival", map);
        }

        @Override
        public void onWaypointArrival(@NonNull RouteProgress routeProgress) {
            WritableMap map = Arguments.createMap();
            map.putBoolean("arrived", true);
            map.putBoolean("waypoint", true);
            sendEvent("onArrival", map);
        }
    };

    @ReactMethod
    public void startNavigation(ReadableMap destination) {
        if (isTripSessionActive)
            stopNavigation();
        MapboxNavigation nav = NavigationManager.get(context);

        // ❌ REMOVED: Voice components now initialized in constructor

        nav.unregisterRouteProgressObserver(routeProgressObserver);
        nav.unregisterVoiceInstructionsObserver(voiceObserver);
        nav.unregisterArrivalObserver(arrivalObserver);

        nav.registerRouteProgressObserver(routeProgressObserver);
        nav.registerVoiceInstructionsObserver(voiceObserver);
        nav.registerArrivalObserver(arrivalObserver);

        startNavigationService();
        requestNavigationRoute(destination);
    }

    @ReactMethod
    public void stopNavigation() {
        MapboxNavigation nav = NavigationManager.get(context);
        nav.stopTripSession();
        nav.unregisterRouteProgressObserver(routeProgressObserver);
        nav.unregisterVoiceInstructionsObserver(voiceObserver);
        nav.unregisterArrivalObserver(arrivalObserver);

        if (uberLocationObserver != null) {
            nav.unregisterLocationObserver(uberLocationObserver);
            uberLocationObserver = null;
        }
        if (voicePlayer != null) {
            voicePlayer.clear();
            voicePlayer.shutdown();
            voicePlayer = null;
        }
        isTripSessionActive = false;
        stopNavigationService();
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        MapboxNavigation nav = NavigationManager.get(context);
        if (nav != null) {
            nav.unregisterVoiceInstructionsObserver(voiceObserver);
        }
        if (speechApi != null) {
            speechApi.cancel();
            // shutdown() is not available/needed in some versions, cancel() is enough for cleanup
        }
        if (voicePlayer != null) {
            voicePlayer.shutdown();
        }
        NavigationManager.destroy();
    }

    @ReactMethod
    public void setMuted(boolean muted) {
        Log.e(TAG, "🔇 setMuted CALLED: " + muted);
        this.isMuted = muted;
        if (voicePlayer != null) {
            voicePlayer.volume(new SpeechVolume(muted ? 0f : 1f));
        }
    }

    @ReactMethod
    public void startUberRide(ReadableMap pickup, ReadableMap dropoff, String status) {
        Log.e(TAG, "🚀 startUberRide CALLED - status: " + status);
        if (isTripSessionActive)
            stopNavigation();

        isTripSessionActive = true;

        new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
            MapboxNavigation nav = NavigationManager.get(context);
            nav.startTripSession();
            Log.e(TAG, "✅ Trip session started");
        });

        MapboxNavigation nav = NavigationManager.get(context);
        // ❌ REMOVED: Voice components now initialized in constructor

        nav.unregisterRouteProgressObserver(routeProgressObserver);
        nav.unregisterVoiceInstructionsObserver(voiceObserver);
        nav.unregisterArrivalObserver(arrivalObserver);

        nav.registerRouteProgressObserver(routeProgressObserver);
        nav.registerVoiceInstructionsObserver(voiceObserver);
        nav.registerArrivalObserver(arrivalObserver);

        startNavigationService();
        Log.e(TAG, "📍 Calling requestUberRoute...");
        requestUberRoute(pickup, dropoff, status);
    }

    private boolean isValidCoordinate(ReadableMap coord) {
        return coord != null && coord.hasKey("lat") && coord.hasKey("lng");
    }

    private void requestNavigationRoute(ReadableMap destination) {
        Log.e(TAG, "📍 requestNavigationRoute CALLED");
        if (!isValidCoordinate(destination)) {
            Log.e(TAG, "Destino inválido!");
            return;
        }

        List<Point> points = new ArrayList<>();
        points.add(Point.fromLngLat(
                destination.hasKey("originLng") ? destination.getDouble("originLng") : 0,
                destination.hasKey("originLat") ? destination.getDouble("originLat") : 0));
        points.add(Point.fromLngLat(destination.getDouble("lng"), destination.getDouble("lat")));
        buildAndRequestRoute(points);
    }

    private void requestUberRoute(ReadableMap pickup, ReadableMap dropoff, String status) {
        Log.e(TAG, "📍 requestUberRoute CALLED - status: " + status + " - pickup: " + pickup + ", dropoff: " + dropoff);
        if (!isValidCoordinate(pickup) || !isValidCoordinate(dropoff)) {
            Log.e(TAG, "❌ Pickup ou Dropoff inválido!");
            WritableMap map = Arguments.createMap();
            map.putString("error", "Coordenadas inválidas");
            sendEvent("onNavigationError", map);
            return;
        }
        Log.e(TAG, "✅ Coordinates valid, registering LocationObserver...");

        // ✅ FIX 5: Use LocationObserver instead of DeviceLocationProvider
        MapboxNavigation nav = NavigationManager.get(context);

        if (uberLocationObserver != null) {
            nav.unregisterLocationObserver(uberLocationObserver);
        }

        uberLocationObserver = new LocationObserver() {
            private boolean hasReceivedLocation = false;

            @Override
            public void onNewRawLocation(@NonNull Location location) {
            }

            @Override
            public void onNewLocationMatcherResult(@NonNull LocationMatcherResult result) {
                Log.e(TAG, "📍 LocationObserver FIRED!");
                if (hasReceivedLocation) {
                    Log.e(TAG, "⚠️ Location already received, ignoring");
                    return;
                }
                hasReceivedLocation = true;

                Location location = result.getEnhancedLocation();
                Log.e(TAG, "✅ Got location: " + location.getLatitude() + ", " + location.getLongitude());

                List<Point> points = new ArrayList<>();
                points.add(Point.fromLngLat(location.getLongitude(), location.getLatitude()));

                if ("accepted".equals(status)) {
                    Log.e(TAG, "📍 Phase: Pickup (Driver -> Pickup)");
                    points.add(Point.fromLngLat(pickup.getDouble("lng"), pickup.getDouble("lat")));
                } else {
                    Log.e(TAG, "📍 Phase: Ongoing (Driver -> Destination)");
                    points.add(Point.fromLngLat(dropoff.getDouble("lng"), dropoff.getDouble("lat")));
                }

                Log.e(TAG, "🗺️ Calling buildAndRequestRoute with " + points.size() + " points...");
                buildAndRequestRoute(points);

                // Unregister after getting location
                nav.unregisterLocationObserver(uberLocationObserver);
            }
        };

        nav.registerLocationObserver(uberLocationObserver);
    }

    private void buildAndRequestRoute(List<Point> points) {
        Log.e(TAG, "🗺️ buildAndRequestRoute CALLED with " + points.size() + " points");
        MapboxNavigation nav = NavigationManager.get(context);

        RouteOptions options = RouteOptions.builder()
                .coordinatesList(points)
                .steps(true)
                .voiceInstructions(true)
                .bannerInstructions(true)
                .language("pt")
                .profile(DirectionsCriteria.PROFILE_DRIVING)
                .build();

        Log.e(TAG, "📡 Requesting routes from Mapbox API...");
        // ✅ FIX 4: Ensure Main Thread for all Mapbox calls
        new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
            nav.requestRoutes(options, new NavigationRouterCallback() {
                @Override
                public void onRoutesReady(@NonNull List<NavigationRoute> routes, @NonNull String routerOrigin) {
                    Log.e(TAG, "🎉 onRoutesReady CALLED - " + routes.size() + " routes received");
                    // Already on Main Thread from outer post()
                    nav.setNavigationRoutes(routes);
                    Log.e(TAG, "✅ setNavigationRoutes() called");
                    nav.startTripSession();
                    Log.e(TAG, "✅ startTripSession() called");
                    isTripSessionActive = true;
                }

                @Override
                public void onFailure(@NonNull List<RouterFailure> reasons, @NonNull RouteOptions routeOptions) {
                    Log.e(TAG, "❌ onFailure CALLED - " + reasons.size() + " errors");
                    for (RouterFailure failure : reasons) {
                        Log.e(TAG, "  ❌ Error: " + failure.getMessage());
                    }
                    WritableMap map = Arguments.createMap();
                    map.putString("error",
                            reasons.isEmpty() ? "Unknown error" : reasons.get(0).getMessage());
                    sendEvent("onNavigationError", map);
                }

                @Override
                public void onCanceled(@NonNull RouteOptions routeOptions, @NonNull String routerOrigin) {
                    Log.i(TAG, "Route request canceled");
                }
            });
        });
    }

    private void sendNavigationProgress(RouteProgress progress, List<Maneuver> maneuvers) {
        WritableMap map = Arguments.createMap();
        if (maneuvers != null && !maneuvers.isEmpty()) {
            map.putString("instruction", maneuvers.get(0).getPrimary().getText());
            map.putString("modifier", maneuvers.get(0).getPrimary().getModifier());
        }

        // Total Trip Metrics
        map.putDouble("distanceRemaining", progress.getDistanceRemaining());
        map.putDouble("durationRemaining", progress.getDurationRemaining());

        // Step (Maneuver) Specific Metrics
        if (progress.getCurrentLegProgress() != null
                && progress.getCurrentLegProgress().getCurrentStepProgress() != null) {
            map.putDouble("stepDistanceRemaining",
                    progress.getCurrentLegProgress().getCurrentStepProgress().getDistanceRemaining());
            map.putDouble("stepDurationRemaining",
                    progress.getCurrentLegProgress().getCurrentStepProgress().getDurationRemaining());
        }

        map.putDouble("percentageTraveled",
                progress.getDistanceTraveled() / (progress.getDistanceTraveled() + progress.getDistanceRemaining()));
        sendEvent("onNavigationProgress", map);
    }

    private void sendEvent(String name, WritableMap params) {
        if (context.hasActiveReactInstance()) {
            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(name, params);
        }
    }

    private void startNavigationService() {
        Intent intent = new Intent(context, MapboxNavigationService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, intent);
        } else {
            context.startService(intent);
        }
    }

    private void stopNavigationService() {
        Intent intent = new Intent(context, MapboxNavigationService.class);
        context.stopService(intent);
    }

    private String accessToken() {
        return context.getString(R.string.mapbox_access_token);
    }
}
