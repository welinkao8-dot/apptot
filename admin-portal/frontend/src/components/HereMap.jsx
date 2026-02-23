import { useEffect, useRef } from 'react';

/**
 * Componente de Mapa HERE Reutilizável para Admin Portal
 */
export default function HereMap({ center, zoom = 13, onMapReady }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const platform = useRef(null);

    useEffect(() => {
        if (!window.H) {
            console.error('❌ HERE Maps SDK não encontrado. Verifique o index.html');
            return;
        }

        if (!mapInstance.current && mapRef.current) {
            platform.current = new window.H.service.Platform({
                apikey: import.meta.env.VITE_HERE_API_KEY
            });

            const defaultLayers = platform.current.createDefaultLayers();

            mapInstance.current = new window.H.Map(
                mapRef.current,
                defaultLayers.vector.normal.map,
                {
                    center: center || { lat: -8.839, lng: 13.289 },
                    zoom: zoom,
                    pixelRatio: window.devicePixelRatio || 1
                }
            );

            const behavior = new window.H.mapevents.Behavior(
                new window.H.mapevents.MapEvents(mapInstance.current)
            );

            const ui = window.H.ui.UI.createDefault(mapInstance.current, defaultLayers);

            if (onMapReady) {
                onMapReady(mapInstance.current, platform.current, ui);
            }

            const handleResize = () => mapInstance.current.getViewPort().resize();
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                if (mapInstance.current) {
                    mapInstance.current.dispose();
                    mapInstance.current = null;
                }
            };
        }
    }, []);

    return (
        <div
            ref={mapRef}
            className="here-map-container"
            style={{ width: '100%', height: '100%', background: '#f8fafc' }}
        />
    );
}
