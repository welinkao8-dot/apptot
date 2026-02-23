/**
 * Serviço de Roteamento usando HERE Maps API v8
 * Documentação: https://developer.here.com/documentation/routing-api/dev_guide/index.html
 */
import { decode } from '@here/flexpolyline';

const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY;
const BASE_URL = 'https://router.hereapi.com/v8/routes';

export const hereRoutingService = {
    /**
     * Calcula a rota entre dois pontos
     * @param {Object} start - { lat, lng }
     * @param {Object} end - { lat, lng }
     * @returns {Promise<Object>} - Dados da rota (geometria, distância, duração)
     */
    async getRoute(start, end) {
        if (!HERE_API_KEY) {
            console.warn('⚠️ VITE_HERE_API_KEY não configurada.');
            return null;
        }

        // Parâmetros: transporte de carro, retorno de polyline e sumário de distância/tempo
        const url = `${BASE_URL}?transportMode=car&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&return=polyline,summary&apiKey=${HERE_API_KEY}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.status || 'Routing Error');
            }

            const data = await response.json();

            if (!data.routes || data.routes.length === 0) {
                throw new Error('Nenhuma rota encontrada.');
            }

            const route = data.routes[0];
            const section = route.sections[0];

            // Decodificar Polyline Flexível da HERE
            const decoded = decode(section.polyline);
            // Converter para o formato Leaflet/HERE JavaScript [lat, lng]
            const geometry = decoded.polyline.map(coord => [coord[0], coord[1]]);

            return {
                geometry,
                distanceMs: section.summary.length, // Metros
                durationSec: section.summary.duration, // Segundos
                distanceKm: (section.summary.length / 1000).toFixed(2),
                durationMin: Math.ceil(section.summary.duration / 60)
            };

        } catch (error) {
            console.error('❌ Erro ao calcular rota HERE:', error);
            return null;
        }
    }
};
