/**
 * Standalone decoder for HERE Flexible Polyline
 * Based on HERE documentation/implementation
 */
function decodeFlexPolyline(encoded) {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const polyline = [];

    const precision = 1e5; // Standard HERE precision for v8

    while (index < encoded.length) {
        let b;
        let shift = 0;
        let result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        polyline.push([lat / precision, lng / precision]);
    }

    return polyline;
}

const HERE_API_KEY = 'UN2gxhPRLhPhUiKVSUTeegOmmDuDwsFcPsQZhX8V040';
const BASE_URL = 'https://router.hereapi.com/v8/routes';

export const hereRoutingService = {
    async getRoute(start, end) {
        if (!HERE_API_KEY) return null;

        const url = `${BASE_URL}?transportMode=car&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&return=polyline,summary&apiKey=${HERE_API_KEY}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Routing Error');

            const data = await response.json();
            if (!data.routes || data.routes.length === 0) return null;

            const section = data.routes[0].sections[0];

            // Use our standalone decoder instead of the missing module
            const geometry = decodeFlexPolyline(section.polyline);

            return {
                geometry,
                rawPolyline: section.polyline, // [NEW] Pass the raw string for the SDK to decode accurately
                distanceMs: section.summary.length,
                durationSec: section.summary.duration,
                distanceKm: (section.summary.length / 1000).toFixed(2),
                durationMin: Math.ceil(section.summary.duration / 60)
            };
        } catch (error) {
            console.error('❌ Erro ao calcular rota HERE (Mobile):', error);
            return null;
        }
    }
};

export default hereRoutingService;
