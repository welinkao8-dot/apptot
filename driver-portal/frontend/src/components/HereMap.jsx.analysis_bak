import { useEffect, useRef } from 'react';

/**
 * Componente de Mapa HERE Reutilizável para Driver Portal
 */
export default function HereMap({ center, zoom = 16, onMapReady }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const platform = useRef(null);

    // Inicialização do Mapa
    useEffect(() => {
        if (!window.H) {
            console.error('❌ HERE Maps SDK não encontrado. Verifique o index.html');
            return;
        }

        let map = null;
        let uiInstance = null;

        if (mapRef.current) {
            try {
                platform.current = new window.H.service.Platform({
                    apikey: import.meta.env.VITE_HERE_API_KEY
                });

                const defaultLayers = platform.current.createDefaultLayers();

                map = new window.H.Map(
                    mapRef.current,
                    defaultLayers.vector.normal.map,
                    {
                        center: center || { lat: -8.839, lng: 13.289 },
                        zoom: zoom,
                        pixelRatio: window.devicePixelRatio || 1
                    }
                );

                // ATUALIZAÇÃO PROFISSIONAL: Habilitar Tráfego e 3D
                if (defaultLayers.vector && defaultLayers.vector.normal) {
                    if (defaultLayers.vector.normal.traffic) {
                        map.addLayer(defaultLayers.vector.normal.traffic);
                    }
                    if (defaultLayers.vector.normal.trafficincidents) {
                        map.addLayer(defaultLayers.vector.normal.trafficincidents);
                    }
                }

                // Habilitar inclinação (tilt) para visualizar edifícios 3D se zoom for alto
                if (zoom > 16) {
                    map.getViewModel().setLookAtData({ tilt: 45 });
                }

                mapInstance.current = map;

                // Adicionar comportamentos (pan, zoom)
                new window.H.mapevents.Behavior(
                    new window.H.mapevents.MapEvents(map)
                );

                // Adicionar UI padrão
                uiInstance = window.H.ui.UI.createDefault(map, defaultLayers);

                if (onMapReady) {
                    onMapReady(map, platform.current, uiInstance);
                }

                // Responsividade
                const handleResize = () => {
                    if (map) map.getViewPort().resize();
                };
                window.addEventListener('resize', handleResize);

                return () => {
                    if (window) window.removeEventListener('resize', handleResize);
                    try {
                        if (uiInstance && typeof uiInstance.dispose === 'function') {
                            uiInstance.dispose();
                        }
                        if (map && typeof map.dispose === 'function') {
                            // Only dispose if container still has children to avoid removeChild errors
                            if (mapRef.current && mapRef.current.children.length > 0) {
                                map.dispose();
                            }
                            mapInstance.current = null;
                            console.log('🧹 Map disposed safely');
                        }
                    } catch (e) {
                        console.warn('Map disposal warning (safe to ignore):', e.message);
                    }
                };
            } catch (err) {
                console.error('Error initializing HERE Map:', err);
            }
        }
    }, []); // Inicializa apenas uma vez

    // Reatividade: Removido setCenter automático para evitar conflitos com animações manuais
    // O controle do centro agora é feito exclusivamente pelo componente pai via mapInstance.current

    return (
        <div
            ref={mapRef}
            className="here-map-container"
            style={{ width: '100%', height: '100%', background: '#f8fafc' }}
        />
    );
}
