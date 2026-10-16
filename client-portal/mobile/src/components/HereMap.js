import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { toSafeErrorLog } from '../utils/safeErrorLog';
import api from '../services/api';
import { createMapCommandQueue } from '../utils/mapCommandQueue';
import { shouldAllowHereMapNavigation } from '../utils/mapNavigation';

const HereMap = forwardRef(({ initialCenter, onMapReady, onMapTap }, ref) => {
    const webViewRef = useRef(null);
    const mapCommandQueueRef = useRef(null);
    const [mapApiKey, setMapApiKey] = useState(null);
    const [mapConfigStatus, setMapConfigStatus] = useState('loading');
    const [webViewStatus, setWebViewStatus] = useState('loading');
    const [webViewAttempt, setWebViewAttempt] = useState(0);
    const isMountedRef = useRef(true);
    const webViewReadyTimerRef = useRef(null);

    if (!mapCommandQueueRef.current) {
        mapCommandQueueRef.current = createMapCommandQueue((code) => {
            webViewRef.current?.injectJavaScript(code);
        });
    }

    const loadMapConfiguration = useCallback(async () => {
        setMapConfigStatus('loading');
        try {
            const { data } = await api.get('/locations/map-config');
            if (typeof data?.apiKey !== 'string' || data.apiKey.length === 0) {
                throw new Error('Map API key is missing');
            }
            if (isMountedRef.current) {
                setMapApiKey(data.apiKey);
                setMapConfigStatus('ready');
            }
        } catch (error) {
            console.info('Map configuration unavailable:', toSafeErrorLog(error));
            if (isMountedRef.current) setMapConfigStatus('error');
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        loadMapConfiguration();
        return () => {
            isMountedRef.current = false;
            clearTimeout(webViewReadyTimerRef.current);
        };
    }, [loadMapConfiguration]);

    const markWebViewFailed = (reason) => {
        clearTimeout(webViewReadyTimerRef.current);
        mapCommandQueueRef.current.onLoadStart();
        if (isMountedRef.current) setWebViewStatus('error');
        console.info('Map WebView unavailable:', reason);
    };

    const handleWebViewLoadStart = () => {
        mapCommandQueueRef.current.onLoadStart();
        setWebViewStatus('loading');
        clearTimeout(webViewReadyTimerRef.current);
        webViewReadyTimerRef.current = setTimeout(() => {
            markWebViewFailed('ready_timeout');
        }, 20000);
    };

    const retryWebView = () => {
        clearTimeout(webViewReadyTimerRef.current);
        mapCommandQueueRef.current.onLoadStart();
        setWebViewStatus('loading');
        setWebViewAttempt((attempt) => attempt + 1);
    };

    const injectJS = (code, key) => {
        mapCommandQueueRef.current.enqueue(code, key);
    };

    useImperativeHandle(ref, () => ({
        setUserLocation: (coords) => {
            injectJS(`window.setUserLocation(${JSON.stringify(coords)});`, 'userLocation');
        },
        setMarkers: (origin, destination) => {
            injectJS(`window.setMarkers(${JSON.stringify(origin)}, ${JSON.stringify(destination)});`, 'markers');
        },
        drawRoute: (geometry, padding) => {
            injectJS(`window.drawRoute(${JSON.stringify(geometry)}, ${JSON.stringify(padding || null)});`, 'route');
        },
        setDriverPosition: (position, isArriving = false) => {
            injectJS(`window.updateDriverMarker(${JSON.stringify(position)}, ${isArriving});`, 'driver');
        },
        clearDriverPosition: () => {
            injectJS('window.clearDriverMarker();', 'driver');
        },
        clearMap: () => {
            injectJS('window.clearMap();', 'clearMap');
        },
        centerOn: (coords, zoom = 15) => {
            injectJS(`window.centerOn(${JSON.stringify(coords)}, ${zoom});`, 'center');
        }
    }));


    const initialCenterJson = JSON.stringify(initialCenter || { lat: -8.839, lng: 13.289 });

    const htmlContent = mapApiKey ? `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>TOT Map Bulletproof</title>
        
        <link rel="stylesheet" type="text/css" href="https://js.api.here.com/v3/3.2/mapsjs-ui.css" />
        <script type="text/javascript" src="https://js.api.here.com/v3/3.2/mapsjs-core.js"></script>
        <script type="text/javascript" src="https://js.api.here.com/v3/3.2/mapsjs-service.js"></script>
        <script type="text/javascript" src="https://js.api.here.com/v3/3.2/mapsjs-ui.js"></script>
        <script type="text/javascript" src="https://js.api.here.com/v3/3.2/mapsjs-mapevents.js"></script>
        <script type="text/javascript" src="https://js.api.here.com/v3/3.2/mapsjs-polyline.js"></script>
        
        <style>
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #f1f5f9; }
            #mapContainer { 
                position: absolute; top: 0; left: 0; bottom: 0; right: 0;
                width: 100%; height: 100%; background: #f1f5f9;
            }
        </style>
    </head>
    <body onload="init()">
        <div id="mapContainer"></div>
        <script>
            let map, platform, behavior, layers;
            let activeMarkers = { user: null, origin: null, dest: null, driver: null };
            let routeGroup = null;

            // Premium SVG Marker Maker ( Canvas Rendered for absolute stability )
            // Usando concatenação simples para evitar problemas com backticks aninhados
            function makePinSvg(color, pulse) {
                let pulsePart = "";
                if (pulse) {
                    pulsePart = '<circle cx="12" cy="22" r="1" fill="' + color + '" opacity="0.6">' +
                        '<animate attributeName="r" from="1" to="9" dur="1.5s" repeatCount="indefinite" />' +
                        '<animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />' +
                        '</circle>';
                }
                
                return '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24">' +
                    pulsePart +
                    '<path fill="' + color + '" stroke="#FFF" stroke-width="0.5" ' +
                    'd="M12 2C8.13 2 5 5.13 5 9c0,5.25 7,13 7,13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>' +
                    '<circle cx="12" cy="9" r="2.5" fill="#FFF" />' +
                    '</svg>';
            }

            function init() {
                try {
                    platform = new H.service.Platform({ 
                        apikey: '${mapApiKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',
                        useHTTPS: true 
                    });
                    layers = platform.createDefaultLayers();
                    const mapLayer = layers.raster.normal.map;

                    const initialCenter = ${initialCenterJson};

                    map = new H.Map(
                        document.getElementById('mapContainer'),
                        mapLayer,
                        {
                            center: initialCenter,
                            zoom: 14,
                            pixelRatio: window.devicePixelRatio || 1
                        }
                    );

                    // Keep HERE's required map attribution and give users basic map controls.
                    H.ui.UI.createDefault(map, layers, 'pt-PT');

                    behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
                    
                    // Add Map Tap/Click Listener
                    map.addEventListener('tap', function(evt) {
                        const coord = map.screenToGeo(evt.currentPointer.viewportX, evt.currentPointer.viewportY);
                        if (coord) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({ 
                                type: 'MAP_TAP', 
                                lat: coord.lat, 
                                lng: coord.lng 
                            }));
                        }
                    });

                    const forceResize = () => map.getViewPort().resize();
                    window.addEventListener('resize', forceResize);
                    setTimeout(forceResize, 500);
                    setTimeout(forceResize, 1500);

                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                } catch (e) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'INIT_ERROR' }));
                }
            }

            window.setUserLocation = (c) => {
                if (activeMarkers.user) map.removeObject(activeMarkers.user);
                const icon = new H.map.Icon(makePinSvg('#E91E63', false), {
                    anchor: { x: 30, y: 55 }
                });
                activeMarkers.user = new H.map.Marker(c, { icon });
                map.addObject(activeMarkers.user);
                map.setCenter(c, true);
            };

            let markersGroup = null;
            window.setMarkers = (o, d) => {
                if (markersGroup) map.removeObject(markersGroup);
                markersGroup = new H.map.Group();

                if (o) {
                    const icon = new H.map.Icon(makePinSvg('#3B82F6', false), { anchor: { x: 30, y: 55 } });
                    activeMarkers.origin = new H.map.Marker(o, { icon });
                    markersGroup.addObject(activeMarkers.origin);
                }
                if (d) {
                    const icon = new H.map.Icon(makePinSvg('#E91E63', false), { anchor: { x: 30, y: 55 } });
                    activeMarkers.dest = new H.map.Marker(d, { icon });
                    markersGroup.addObject(activeMarkers.dest);
                }
                
                map.addObject(markersGroup);
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOG', msg: 'Markers rendered: origin=' + Boolean(o) + ', destination=' + Boolean(d) }));

                if (o && d) {
                    const bounds = markersGroup.getBoundingBox();
                    if (bounds) {
                        map.getViewPort().setPadding(80, 48, 80, 48);
                        map.getViewModel().setLookAtData({ bounds: bounds }, true);
                    }
                } else if (o) {
                    map.setCenter(o, true);
                }
            };

            window.drawRoute = (data, padding) => {
                try {
                    if (routeGroup) map.removeObject(routeGroup);
                    if (!data) return;

                    let lineString;
                    if (typeof data === 'string') {
                        lineString = H.geo.LineString.fromFlexiblePolyline(data);
                    } else if (Array.isArray(data)) {
                        lineString = new H.geo.LineString();
                        data.forEach(p => lineString.pushPoint({ lat: p[0], lng: p[1] }));
                    }

                    if (!lineString || lineString.getPointCount() === 0) return;
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOG', msg: 'Route decoded: ' + lineString.getPointCount() + ' points' }));

                    const routeLine = new H.map.Polyline(lineString, {
                        style: { strokeColor: '#E91E63', lineWidth: 6, lineCap: 'round', lineJoin: 'round' }
                    });
                    
                    routeGroup = new H.map.Group();
                    routeGroup.addObjects([routeLine]);
                    map.addObject(routeGroup);
                    
                    const bounds = routeGroup.getBoundingBox();
                    if (bounds) {
                        const viewportPadding = padding || { top: 80, right: 48, bottom: 80, left: 48 };
                        map.getViewPort().setPadding(
                            viewportPadding.top,
                            viewportPadding.right,
                            viewportPadding.bottom,
                            viewportPadding.left,
                        );
                        map.getViewModel().setLookAtData({ bounds: bounds }, true);
                    }
                } catch (e) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOG', msg: 'drawRoute Error: ' + (e?.message || 'unknown error') }));
                }
            };

            window.updateDriverMarker = (pos, isArriving) => {
                if (activeMarkers.driver) map.removeObject(activeMarkers.driver);
                const icon = new H.map.Icon(makePinSvg('#008C95', isArriving), {
                    anchor: { x: 30, y: 55 }
                });
                activeMarkers.driver = new H.map.Marker(pos, { icon });
                map.addObject(activeMarkers.driver);
            };

            window.clearDriverMarker = () => {
                if (activeMarkers.driver) map.removeObject(activeMarkers.driver);
                activeMarkers.driver = null;
            };

            window.clearMap = () => {
                if (markersGroup) {
                    map.removeObject(markersGroup);
                    markersGroup = null;
                }
                if (routeGroup) {
                    map.removeObject(routeGroup);
                    routeGroup = null;
                }
                if (activeMarkers.user) map.removeObject(activeMarkers.user);
                if (activeMarkers.driver) map.removeObject(activeMarkers.driver);
                activeMarkers = { user: null, origin: null, dest: null, driver: null };
            };

            window.centerOn = (c, z) => { 
                map.setCenter(c, true); 
                if (z) map.setZoom(z, true); 
            };
        </script>
    </body>
    </html>
    ` : null;

    return (
        <View style={styles.container}>
            {htmlContent && webViewStatus === 'error' ? <View style={styles.loadingContainer}>
                <Text style={styles.errorTitle}>Não foi possível carregar o mapa</Text>
                <Text style={styles.loadingText}>Verifique a ligação à internet e tente novamente.</Text>
                <Pressable accessibilityRole="button" onPress={retryWebView} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Tentar novamente</Text>
                </Pressable>
            </View> : htmlContent ? <WebView
                key={webViewAttempt}
                ref={webViewRef}
                originWhitelist={['https://www.here.com', 'https://*.here.com', 'https://*.hereapi.com']}
                source={{ html: htmlContent, baseUrl: 'https://www.here.com' }}
                style={styles.webview}
                onLoadStart={handleWebViewLoadStart}
                onError={(event) => markWebViewFailed(`load_error_${event.nativeEvent?.code ?? 'unknown'}`)}
                onHttpError={(event) => markWebViewFailed(`http_${event.nativeEvent?.statusCode ?? 'unknown'}`)}
                onShouldStartLoadWithRequest={(request) => shouldAllowHereMapNavigation(request.url)}
                onMessage={(e) => {
                    try {
                        const d = JSON.parse(e.nativeEvent.data);
                        if (d.type === 'READY') {
                            clearTimeout(webViewReadyTimerRef.current);
                            mapCommandQueueRef.current.onReady();
                            setWebViewStatus('ready');
                            onMapReady?.();
                        }
                        if (d.type === 'INIT_ERROR') markWebViewFailed('init_error');
                        if (d.type === 'MAP_TAP' && onMapTap) {
                            onMapTap({ lat: d.lat, lng: d.lng }); // Correctly propagating tap
                        }
                        if (d.type === 'LOG') console.log('🗺️ [WebView Map Debug]:', d.msg);
                    } catch (err) { }
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mixedContentMode="never"
                allowFileAccess={false}
            /> : mapConfigStatus === 'error' ? <View style={styles.loadingContainer}>
                <Text style={styles.errorTitle}>Não foi possível carregar o mapa</Text>
                <Text style={styles.loadingText}>Verifique a ligação à internet e tente novamente.</Text>
                <Pressable accessibilityRole="button" onPress={loadMapConfiguration} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Tentar novamente</Text>
                </Pressable>
            </View> : <View style={styles.loadingContainer}>
                <ActivityIndicator color="#E91E63" />
                <Text style={styles.loadingText}>A carregar o mapa…</Text>
            </View>}
        </View>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    webview: { flex: 1, backgroundColor: 'transparent' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: '#64748B', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
    errorTitle: { color: '#0F172A', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    retryButton: { backgroundColor: '#E91E63', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
    retryButtonText: { color: '#FFFFFF', fontWeight: '600' },
});

export default HereMap;
