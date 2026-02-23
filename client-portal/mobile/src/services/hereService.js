/**
 * Serviço de Geocoding e Busca usando HERE Maps API v7
 */

const HERE_API_KEY = 'UN2gxhPRLhPhUiKVSUTeegOmmDuDwsFcPsQZhX8V040';
const BASE_URL = 'https://geocode.search.hereapi.com/v1';

export const hereService = {
    /**
     * Busca sugestões de endereço (Autocomplete)
     */
    async fetchSuggestions(query, center = { lat: -8.839, lng: 13.289 }) {
        if (!query || query.length < 3) return [];

        const url = `${BASE_URL}/autosuggest?q=${encodeURIComponent(query)}&apiKey=${HERE_API_KEY}&lang=pt&in=countryCode:AGO&limit=5&show=details&at=${center.lat},${center.lng}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HERE Autosuggest Error');
            const data = await response.json();

            return data.items.map(item => {
                let formattedAddress = item.address.label;
                if (item.address.street) {
                    formattedAddress = `${item.address.street}${item.address.houseNumber ? ', ' + item.address.houseNumber : ''}`;
                    if (item.address.district) formattedAddress += ` - ${item.address.district}`;
                }

                return {
                    id: item.id,
                    name: item.title,
                    address: formattedAddress,
                    lat: item.position?.lat,
                    lng: item.position?.lng,
                };
            });
        } catch (error) {
            console.error('HERE Autocomplete Error:', error);
            return [];
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
            console.error('HERE Reverse Geocoding Error:', error);
            return null;
        }
    }
};

export default hereService;
