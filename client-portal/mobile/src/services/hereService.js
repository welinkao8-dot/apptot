import { toSafeErrorLog } from '../utils/safeErrorLog';
import api from './api';

const successfulSearches = new Map();
const MAX_CACHED_SEARCHES = 10;

function withSearchState(items, status, retryable = false) {
    Object.defineProperties(items, {
        status: { value: status, configurable: true },
        retryable: { value: retryable, configurable: true },
    });
    return items;
}

function getSearchKey(query, center) {
    return `${query.trim().toLocaleLowerCase()}|${center.lat}|${center.lng}`;
}

function classifySearchError(error) {
    const status = Number(error?.response?.status);
    if (status === 429) return { status: 'rate_limited', retryable: true };
    if (status >= 500) return { status: 'server_error', retryable: true };
    if (status > 0) return { status: 'request_error', retryable: false };

    const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
    if (['ECONNABORTED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code)) {
        return { status: 'timeout', retryable: true };
    }
    if (code === 'ERR_NETWORK' || (error?.request && !error?.response)) {
        return { status: 'offline', retryable: true };
    }
    return { status: 'server_error', retryable: true };
}

/**
 * Serviço de Geocoding e Busca usando HERE Maps API v7
 */

export const hereService = {
    /**
     * Busca sugestões de endereço (Autocomplete)
     */
    async fetchSuggestions(query, center = { lat: -8.839, lng: 13.289 }) {
        center = center || { lat: -8.839, lng: 13.289 }; // Search bias only; never used as a trip pickup.
        if (!query || query.trim().length < 3) return withSearchState([], 'idle');

        const searchKey = getSearchKey(query, center);

        try {
            const response = await api.get('/locations/autosuggest', {
                params: { q: query, lat: center.lat, lng: center.lng },
            });
            const items = Array.isArray(response.data) ? response.data : [];

            const suggestions = items.map(item => {
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

            if (suggestions.length === 0) {
                successfulSearches.delete(searchKey);
                return withSearchState([], 'no_results');
            }

            successfulSearches.delete(searchKey);
            successfulSearches.set(searchKey, suggestions);
            if (successfulSearches.size > MAX_CACHED_SEARCHES) {
                successfulSearches.delete(successfulSearches.keys().next().value);
            }
            return withSearchState([...suggestions], 'success');
        } catch (error) {
            console.info('Address search unavailable:', toSafeErrorLog(error));
            const failure = classifySearchError(error);
            const previousItems = [...(successfulSearches.get(searchKey) || [])];
            return withSearchState(previousItems, failure.status, failure.retryable);
        }
    },

    /**
     * Reverse Geocoding (Coordenadas -> Endereço)
     */
    async reverseGeocode(lat, lng) {
        try {
            const response = await api.get('/locations/reverse-geocode', { params: { lat, lng } });
            return response.data || null;
        } catch (error) {
            console.info('Reverse geocoding unavailable:', toSafeErrorLog(error));
            return null;
        }
    }
};

export default hereService;
