
/**
 * Serviço de Geocoding usando MapTiler (Flex Plan)
 * Documentação: https://docs.maptiler.com/cloud/api/geocoding/
 */

const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY;
const BASE_URL = 'https://api.maptiler.com/geocoding';

export const geocodingService = {
    /**
     * Busca sugestões de endereço
     * @param {string} query - Texto da busca
     * @param {Object} center - { lat, lng } Opcional: viés de proximidade
     * @returns {Promise<Array>} - Lista de locais
     */
    async searchAddress(query, center = null) {
        if (!query || query.length < 3) return [];
        if (!MAPTILER_API_KEY) {
            console.warn('⚠️ VITE_MAPTILER_API_KEY não configurada. Geocoding desabilitado.');
            return [];
        }

        try {
            // Construir URL com viés de proximidade virado para Angola/Luanda se não fornecido
            // bbox para Angola aprox: 11.6,-18.0,24.1,-4.3
            let url = `${BASE_URL}/${encodeURIComponent(query)}.json?key=${MAPTILER_API_KEY}&language=pt&limit=5&country=ao`;

            // Se tiver centro do mapa, usar como proximity
            if (center) {
                url += `&proximity=${center.lng},${center.lat}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('MapTiler Geocoding Error');
            }

            const data = await response.json();

            // MapTiler retorna GeoJSON Features
            return data.features.map(feature => ({
                id: feature.id,
                place_name: feature.place_name,
                center: feature.center, // [lng, lat]
                text: feature.text,
                relevance: feature.relevance
            }));

        } catch (error) {
            console.error('❌ Erro no Geocoding:', error);
            return [];
        }
    },

    /**
     * Obtém endereço a partir de coordenadas (Reverse Geocoding)
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<string|null>} - Nome do local formatado ou null
     */
    async reverseGeocode(lat, lng) {
        if (!MAPTILER_API_KEY) return null;
        try {
            const url = `${BASE_URL}/${lng},${lat}.json?key=${MAPTILER_API_KEY}&language=pt&limit=1`;
            const response = await fetch(url);

            if (!response.ok) throw new Error('Reverse Geocoding Failed');

            const data = await response.json();
            if (data.features && data.features.length > 0) {
                return data.features[0].place_name;
            }
            return null;
        } catch (error) {
            console.error('❌ Erro no Reverse Geocoding:', error);
            return null;
        }
    }
};
