package com.taxitot.driver;

import android.content.Context;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.mapbox.common.location.Location;
import com.mapbox.maps.MapView;
import com.mapbox.maps.Style;
import com.mapbox.maps.ImageHolder;
import com.mapbox.maps.plugin.locationcomponent.LocationComponentPlugin;
import com.mapbox.maps.plugin.LocationPuck2D;
import com.mapbox.maps.plugin.animation.CameraAnimationsPlugin;
import static com.mapbox.maps.plugin.Plugin.MAPBOX_LOCATION_COMPONENT_PLUGIN_ID;
import static com.mapbox.maps.plugin.Plugin.MAPBOX_CAMERA_PLUGIN_ID;
import androidx.core.content.ContextCompat;
import com.mapbox.navigation.core.MapboxNavigation;
import com.mapbox.navigation.core.trip.session.LocationMatcherResult;
import com.mapbox.navigation.core.trip.session.LocationObserver;
import com.mapbox.navigation.core.trip.session.RouteProgressObserver;
import com.mapbox.navigation.core.directions.session.RoutesObserver;
import com.mapbox.navigation.ui.maps.camera.NavigationCamera;
import com.mapbox.navigation.ui.maps.camera.data.FollowingFrameOptions;
import com.mapbox.navigation.ui.maps.camera.data.MapboxNavigationViewportDataSource;
import com.mapbox.navigation.ui.maps.camera.data.MapboxNavigationViewportDataSourceOptions;
import com.mapbox.navigation.ui.maps.camera.transition.MapboxNavigationCameraStateTransition;
import com.mapbox.navigation.ui.maps.camera.transition.MapboxNavigationCameraTransition;
import com.mapbox.navigation.ui.maps.location.NavigationLocationProvider;

// === PACOTES ROUTE LINE ===
import com.mapbox.navigation.ui.maps.route.line.api.MapboxRouteLineApi;
import com.mapbox.navigation.ui.maps.route.line.api.MapboxRouteLineView;
import com.mapbox.navigation.ui.maps.route.line.model.MapboxRouteLineApiOptions;
import com.mapbox.navigation.ui.maps.route.line.model.MapboxRouteLineViewOptions;
import com.mapbox.navigation.ui.maps.route.line.model.RouteLineError;
import com.mapbox.navigation.ui.maps.route.line.model.RouteSetValue;

/**
 * MapboxNavigationView implementation for V3 SDK
 * handles RouteLine, Camera and Location Puck
 */
public class MapboxNavigationView extends FrameLayout {

    private final MapView mapView;
    private final NavigationCamera navigationCamera;
    private final MapboxNavigationViewportDataSource viewportDataSource;

    // Handler for Main Thread UI updates
    private final android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());

    // V3 Visual Components
    private final MapboxRouteLineApi routeLineApi;
    private final MapboxRouteLineView routeLineView;
    private final NavigationLocationProvider locationProvider = new NavigationLocationProvider();

    // Observers
    private final RouteProgressObserver routeProgressObserver;
    private final RoutesObserver routesObserver;
    private final LocationObserver locationObserver;

    public MapboxNavigationView(@NonNull Context context) {
        super(context);

        this.mapView = new MapView(context);
        addView(mapView);

        // 1. Initialize ViewportDataSource
        this.viewportDataSource = new MapboxNavigationViewportDataSource(mapView.getMapboxMap());

        // 2. Initialize Camera Logic
        CameraAnimationsPlugin cameraAnimationsPlugin = (CameraAnimationsPlugin) mapView
                .getPlugin(MAPBOX_CAMERA_PLUGIN_ID);

        MapboxNavigationCameraTransition transitionHelper = new MapboxNavigationCameraTransition(
                mapView.getMapboxMap(),
                cameraAnimationsPlugin);

        MapboxNavigationCameraStateTransition stateTransition = new MapboxNavigationCameraStateTransition(
                mapView.getMapboxMap(),
                cameraAnimationsPlugin,
                transitionHelper);

        this.navigationCamera = new NavigationCamera(
                mapView.getMapboxMap(),
                cameraAnimationsPlugin,
                viewportDataSource,
                stateTransition);

        // 3. Initialize RouteLine API & View
        this.routeLineApi = new MapboxRouteLineApi(new MapboxRouteLineApiOptions.Builder().build());
        this.routeLineView = new MapboxRouteLineView(new MapboxRouteLineViewOptions.Builder(context).build());

        // 4. Setup Map Style & Location Puck
        mapView.getMapboxMap().loadStyleUri(
                Style.MAPBOX_STREETS,
                style -> {
                    // ✅ IMPLEMENTAÇÃO OFICIAL V11
                    LocationComponentPlugin locationPlugin = (LocationComponentPlugin) mapView
                            .getPlugin(MAPBOX_LOCATION_COMPONENT_PLUGIN_ID);

                    if (locationPlugin != null) {
                        locationPlugin.setLocationProvider(locationProvider);
                        locationPlugin.setEnabled(true);
                        locationPlugin.setPuckBearingEnabled(true);

                        LocationPuck2D puck = new LocationPuck2D(
                                null, // topImage
                                ImageHolder.from(R.drawable.ic_car), // bearingImage
                                null, // shadowImage
                                null, // scaleExpression
                                1.0f // opacity
                        );
                        locationPlugin.setLocationPuck(puck);
                    }

                    // Set Camera to Following by default once map is loaded
                    navigationCamera.requestNavigationCameraToFollowing();
                });

        // 5. OBSERVERS IMPLEMENTATION

        // A. Route Progress -> Update Camera & Route Line coloring
        this.routeProgressObserver = progress -> {
            mainHandler.post(() -> {
                viewportDataSource.onRouteProgressChanged(progress);
                viewportDataSource.evaluate();
            });
        };

        // B. Routes -> Draw the line on the map
        this.routesObserver = result -> {
            mainHandler.post(() -> {
                if (result.getNavigationRoutes().isEmpty()) {
                    // Clear route line
                    routeLineApi.clearRouteLine(expected -> {
                        if (mapView.getMapboxMap().getStyle() != null) {
                            routeLineView.renderClearRouteLineValue(mapView.getMapboxMap().getStyle(), expected);
                        }
                    });
                    return;
                }

                // Draw new route
                routeLineApi.setNavigationRoutes(result.getNavigationRoutes(), expected -> {
                    if (mapView.getMapboxMap().getStyle() != null) {
                        routeLineDrawData(expected);
                    }
                });

                // Focus camera on new route
                viewportDataSource.onRouteChanged(result.getNavigationRoutes().get(0));
                viewportDataSource.evaluate();

                // Uber-style: Overview once, then transition to Following after 1.5s
                navigationCamera.requestNavigationCameraToOverview();
                mainHandler.postDelayed(() -> {
                    navigationCamera.requestNavigationCameraToFollowing();
                }, 1500);
            });
        };

        // C. Location -> Update Puck & Camera
        this.locationObserver = new LocationObserver() {
            @Override
            public void onNewRawLocation(@NonNull Location location) {
                // Raw location updates if needed
            }

            @Override
            public void onNewLocationMatcherResult(@NonNull LocationMatcherResult result) {
                mainHandler.post(() -> {
                    Location location = result.getEnhancedLocation();
                    // Update properties for the Puck
                    locationProvider.changePosition(location, result.getKeyPoints(), null, null);

                    // Update properties for the Camera
                    viewportDataSource.onLocationChanged(location);
                    updateCameraBySpeed(location.getSpeed());
                    viewportDataSource.evaluate();
                });
            }
        };

        // 6. REGISTER OBSERVERS
        MapboxNavigation nav = NavigationManager.get(context);
        nav.registerRoutesObserver(routesObserver);
        nav.registerRouteProgressObserver(routeProgressObserver);
        nav.registerLocationObserver(locationObserver);
    }

    public MapView getMapView() {
        return mapView;
    }

    public void setStyle(String styleUri) {
        if (mapView != null) {
            mapView.getMapboxMap().loadStyleUri(styleUri);
        }
    }

    public void recenter() {
        if (navigationCamera != null) {
            navigationCamera.requestNavigationCameraToFollowing();
        }
    }

    public void overview() {
        if (navigationCamera != null) {
            navigationCamera.requestNavigationCameraToOverview();
        }
    }

    private void routeLineDrawData(com.mapbox.bindgen.Expected<RouteLineError, RouteSetValue> expected) {
        if (mapView.getMapboxMap().getStyle() != null) {
            routeLineView.renderRouteDrawData(mapView.getMapboxMap().getStyle(), expected);
        }
    }

    private void updateCameraBySpeed(Double speedMps) {
        if (speedMps == null)
            return;
        double speedKmh = speedMps * 3.6;

        double zoom;
        double pitch;

        if (speedKmh < 20) {
            zoom = 17.5;
            pitch = 30.0;
        } else if (speedKmh < 50) {
            zoom = 16.5;
            pitch = 45.0;
        } else {
            zoom = 15.5;
            pitch = 60.0;
        }

        // 🏁 FINAL AUDIT COMPLIANCE: Use direct property overrides as per verified doc
        // v3.18.1
        viewportDataSource.followingZoomPropertyOverride(zoom);
        viewportDataSource.followingPitchPropertyOverride(pitch);
        viewportDataSource.evaluate();
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        mapView.onStart();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        mapView.onStop();
        // ❌ DO NOT call mapView.onDestroy() here - Maps SDK 11 requirement
        // onDestroy() should only be called when Activity/Fragment dies, not on View
        // detach

        // Clean RouteLine resources
        routeLineApi.cancel();
        routeLineView.cancel();

        // Cleanup Observers to avoid leaks
        MapboxNavigation nav = NavigationManager.get(getContext());
        if (nav != null) {
            nav.unregisterRoutesObserver(routesObserver);
            nav.unregisterRouteProgressObserver(routeProgressObserver);
            nav.unregisterLocationObserver(locationObserver);
        }
    }
}
