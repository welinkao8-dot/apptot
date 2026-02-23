
/**
 * Serviço de Roteamento usando OpenRouteService (Free Tier)
 * Documentação: https://openrouteservice.org/dev/#/api-docs
 */

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;
const BASE_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';

export const routingService = {
    /**
     * Calcula a rota entre dois pontos
     * @param {Object} start - { lat, lng }
     * @param {Object} end - { lat, lng }
     * @returns {Promise<Object>} - { geometry, summary, distance, duration }
     */
    async getRoute(start, end) {
        if (!ORS_API_KEY) {
            console.warn('⚠️ VITE_ORS_API_KEY não configurada. Roteamento desabilitado.');
            return null;
        }

        try {
            const url = `${BASE_URL}?api_key=${ORS_API_KEY}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`ORS API Error: ${response.statusText}`);
            }

            const data = await response.json();

            // Extrair dados relevantes da feature collection
            const feature = data.features[0];
            const geometry = feature.geometry.coordinates; // Array of [lng, lat]
            const summary = feature.properties.summary; // { distance: meters, duration: seconds }

            // Converter geometria para formato Lealfet [lat, lng]
            const decodedGeometry = geometry.map(coord => [coord[1], coord[0]]);

            return {
                geometry: decodedGeometry,
                distanceMs: summary.distance, // Metros
                durationSec: summary.duration, // Segundos
                distanceKm: (summary.distance / 1000).toFixed(2),
                durationMin: Math.ceil(summary.duration / 60)
            };

        } catch (error) {
            console.error('❌ Erro ao calcular rota:', error);
            return null;
        }
    }
};
