/**
 * Serviço de Geocoding e Busca usando HERE Maps API v7
 * Documentação: https://developer.here.com/documentation/geocoding-search-api/dev_guide/index.html
 */

const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY;
const BASE_URL = 'https://geocode.search.hereapi.com/v1';

export const hereGeocodingService = {
    /**
     * Busca sugestões de endereço (Autocomplete)
     * @param {string} query - Texto da busca
     * @param {Object} center - { lat, lng } Proximidade para Luanda
     * @returns {Promise<Array>} - Lista de sugestões formatadas
     */
    async fetchSuggestions(query, center = null) {
        if (!query || query.length < 3) return [];
        if (!HERE_API_KEY) {
            console.warn('⚠️ VITE_HERE_API_KEY não configurada.');
            return [];
        }

        // ATUALIZAÇÃO PROFISSIONAL: Usar endpoint autosuggest com show=details para retornar estruturado
        let url = `${BASE_URL}/autosuggest?q=${encodeURIComponent(query)}&apiKey=${HERE_API_KEY}&lang=pt&in=countryCode:AGO&limit=5&show=details`;

        if (center) {
            url += `&at=${center.lat},${center.lng}`;
        }

        console.log('📡 URL da requisição:', url);

        try {
            const response = await fetch(url);
            console.log('📥 Response status:', response.status);

            if (!response.ok) throw new Error('HERE Autosuggest Error');
            const data = await response.json();
            console.log('📦 Data recebida:', data);

            const suggestions = data.items.map(item => {
                // Formatar endereço estruturado se disponível
                let formattedAddress = item.address.label;
                if (item.address.street) {
                    formattedAddress = `${item.address.street}${item.address.houseNumber ? ', ' + item.address.houseNumber : ''}`;
                    if (item.address.district) formattedAddress += ` - ${item.address.district}`;
                }

                return {
                    id: item.id,
                    title: item.title,
                    address: formattedAddress,
                    text: item.title,
                    place_name: formattedAddress,
                    position: item.position, // Autosuggest geralmente retorna posição
                    access: item.access // Ponto de acesso para roteamento preciso
                };
            });

            console.log('✅ Sugestões formatadas:', suggestions);
            return suggestions;
        } catch (error) {
            console.error('❌ Erro no HERE Autocomplete:', error);
            return [];
        }
    },

    /**
     * Busca geocodificação direta (para busca manual via Enter)
     */
    async geocode(query, center = null) {
        let url = `${BASE_URL}/geocode?q=${encodeURIComponent(query)}&apiKey=${HERE_API_KEY}&lang=pt&in=countryCode:AGO&limit=1`;

        if (center) {
            url += `&at=${center.lat},${center.lng}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const item = data.items[0];
                return {
                    lat: item.position.lat,
                    lng: item.position.lng,
                    address: item.address.label,
                    title: item.title
                };
            }
            return null;
        } catch (error) {
            console.error('❌ Erro no HERE Geocode:', error);
            return null;
        }
    },

    /**
     * Reverse Geocoding (Coordenadas -> Endereço)
     */
    async reverseGeocode(lat, lng) {
        const url = `${BASE_URL}/revgeocode?at=${lat},${lng}&apiKey=${HERE_API_KEY}&lang=pt`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HERE Reverse Geocoding Failed');
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                return data.items[0].address.label;
            }
            return null;
        } catch (error) {
            console.error('❌ Erro no HERE Reverse Geocoding:', error);
            return null;
        }
    },

    /**
     * Discover API - Busca POIs por categoria (restaurantes, hotéis, etc.)
     * @param {string} category - categoria (ex: 'restaurant', 'hotel', 'hospital')
     * @param {Object} center - { lat, lng } Centro da busca
     */
    async discoverPlaces(category, center) {
        if (!center || !HERE_API_KEY) return [];

        // Mapeamento de categorias simplificado para query param "q" ou "categories"
        // Para simplicidade usaremos busca livre "q" com viés de localização
        const url = `${BASE_URL}/discover?q=${category}&at=${center.lat},${center.lng}&limit=5&apiKey=${HERE_API_KEY}&lang=pt`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HERE Discover API Failed');
            const data = await response.json();

            return data.items.map(item => ({
                id: item.id,
                title: item.title,
                address: item.address.label,
                position: item.position,
                category: item.categories?.[0]?.name || 'Local',
                distance: item.distance // Distância do centro em metros
            }));
        } catch (error) {
            console.error('❌ Erro no HERE Discover:', error);
            return [];
        }
    }
};
