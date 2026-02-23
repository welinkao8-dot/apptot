import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const HERE_API_KEY = 'UN2gxhPRLhPhUiKVSUTeegOmmDuDwsFcPsQZhX8V040';

const HereMap = forwardRef(({ initialCenter, onMapReady, onMapTap }, ref) => {
    const webViewRef = useRef(null);

    const injectJS = (code) => {
        webViewRef.current?.injectJavaScript(code);
    };

    useImperativeHandle(ref, () => ({
        setUserLocation: (coords) => {
            injectJS(`window.setUserLocation(${JSON.stringify(coords)});`);
        },
        setMarkers: (origin, destination) => {
            injectJS(`window.setMarkers(${JSON.stringify(origin)}, ${JSON.stringify(destination)});`);
        },
        drawRoute: (geometry) => {
            injectJS(`window.drawRoute(${JSON.stringify(geometry)});`);
        },
        setDriverPosition: (position, isArriving = false) => {
            injectJS(`window.updateDriverMarker(${JSON.stringify(position)}, ${isArriving});`);
        },
        clearMap: () => {
            injectJS(`window.clearMap();`);
        },
        centerOn: (coords, zoom = 15) => {
            injectJS(`window.centerOn(${JSON.stringify(coords)}, ${zoom});`);
        }
    }));

    const initialCenterJson = JSON.stringify(initialCenter || { lat: -8.839, lng: 13.289 });

    const htmlContent = `
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
            .H_copyright { display: none !important; }
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
                        apikey: '${HERE_API_KEY}',
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
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOG', msg: 'Init Error: ' + e.message }));
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
                    const icon = new H.map.Icon(makePinSvg('#E91E63', false), { anchor: { x: 30, y: 55 } });
                    activeMarkers.origin = new H.map.Marker(o, { icon });
                    markersGroup.addObject(activeMarkers.origin);
                }
                if (d) {
                    const icon = new H.map.Icon(makePinSvg('#10b981', false), { anchor: { x: 30, y: 55 } });
                    activeMarkers.dest = new H.map.Marker(d, { icon });
                    markersGroup.addObject(activeMarkers.dest);
                }
                
                map.addObject(markersGroup);

                if (o && d) {
                    const bounds = markersGroup.getBoundingBox();
                    if (bounds) {
                        map.getViewModel().setLookAtData({ 
                            bounds: bounds,
                            padding: { top: 120, bottom: 120, left: 60, right: 60 }
                        }, true);
                    }
                } else if (o) {
                    map.setCenter(o, true);
                }
            };

            window.drawRoute = (data) => {
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

                    const routeLine = new H.map.Polyline(lineString, {
                        style: { strokeColor: '#E91E63', lineWidth: 6, lineCap: 'round', lineJoin: 'round' }
                    });
                    
                    routeGroup = new H.map.Group();
                    routeGroup.addObjects([routeLine]);
                    map.addObject(routeGroup);
                    
                    const bounds = routeGroup.getBoundingBox();
                    if (bounds) {
                        map.getViewModel().setLookAtData({ 
                            bounds: bounds,
                            padding: { top: 120, bottom: 120, left: 60, right: 60 }
                        }, true);
                    }
                } catch (e) {
                    console.error('drawRoute Error:', e.message);
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
                activeMarkers = { user: null, origin: null, dest: null, driver: null };
            };

            window.centerOn = (c, z) => { 
                map.setCenter(c, true); 
                if (z) map.setZoom(z, true); 
            };
        </script>
    </body>
    </html>
    `;

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: htmlContent, baseUrl: 'https://www.here.com' }}
                style={styles.webview}
                onMessage={(e) => {
                    try {
                        const d = JSON.parse(e.nativeEvent.data);
                        if (d.type === 'READY' && onMapReady) onMapReady();
                        if (d.type === 'MAP_TAP' && onMapTap) {
                            onMapTap({ lat: d.lat, lng: d.lng }); // Correctly propagating tap
                        }
                        if (d.type === 'LOG') console.log('🗺️ [WebView Map Debug]:', d.msg);
                    } catch (err) { }
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mixedContentMode="always"
                allowFileAccess={true}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    webview: { flex: 1, backgroundColor: 'transparent' }
});

export default HereMap;
