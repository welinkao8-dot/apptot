import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

export type RouteCoordinates = { originLat: number; originLng: number; destLat: number; destLng: number };

@Injectable()
export class HereRoutingProvider {
  async getRoute(coords: RouteCoordinates): Promise<{ distanceMeters: number; durationSeconds: number; polyline?: string }> {
    const apiKey = process.env.HERE_ROUTING_API_KEY?.trim();
    if (!apiKey) throw new ServiceUnavailableException('O serviço de cotação de rotas não está configurado.');

    try {
      const response = await axios.get('https://router.hereapi.com/v8/routes', {
        params: {
          transportMode: 'car',
          origin: `${coords.originLat},${coords.originLng}`,
          destination: `${coords.destLat},${coords.destLng}`,
          return: 'polyline,summary',
          apiKey,
        },
        timeout: 8000,
      });
      const summary = response.data?.routes?.[0]?.sections?.[0]?.summary;
      const polyline = response.data?.routes?.[0]?.sections?.[0]?.polyline;
      if (!Number.isFinite(summary?.length) || !Number.isFinite(summary?.duration)
        || summary.length <= 0 || summary.duration <= 0
        || typeof polyline !== 'string' || polyline.length === 0) {
        throw new Error('Invalid HERE route summary');
      }
      return {
        distanceMeters: summary.length,
        durationSeconds: summary.duration,
        polyline,
      };
    } catch {
      throw new ServiceUnavailableException('Não foi possível obter uma rota para calcular a cotação.');
    }
  }
}
