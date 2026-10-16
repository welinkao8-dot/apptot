import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

export type RouteCoordinates = { originLat: number; originLng: number; destLat: number; destLng: number };
export type HereTransportMode = 'car' | 'scooter' | 'truck';

@Injectable()
export class HereRoutingProvider {
  private readonly logger = new Logger(HereRoutingProvider.name);

  async getRoute(coords: RouteCoordinates, transportMode: HereTransportMode = 'car'): Promise<{ distanceMeters: number; durationSeconds: number; polyline: string }> {
    const apiKey = process.env.HERE_ROUTING_API_KEY?.trim();
    if (!apiKey) {
      this.logger.error('HERE_ROUTING_API_KEY is not configured.');
      throw new ServiceUnavailableException('O serviço de cotação de rotas não está configurado.');
    }

    try {
      const params = {
          transportMode,
          origin: `${coords.originLat},${coords.originLng}`,
          destination: `${coords.destLat},${coords.destLng}`,
          return: 'polyline,summary',
          apiKey,
      };
      const response = await this.requestRoute(params);
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
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const code = axios.isAxiosError(error) ? error.code : undefined;
      this.logger.warn(`HERE ${transportMode} route failed${status ? ` with HTTP ${status}` : ''}${code ? ` (${code})` : ''}.`);
      throw new ServiceUnavailableException('Não foi possível obter uma rota para calcular a cotação.');
    }
  }

  private async requestRoute(params: Record<string, string>) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await axios.get('https://router.hereapi.com/v8/routes', { params, timeout: 8000 });
      } catch (error) {
        const code = typeof axios.isAxiosError === 'function' && axios.isAxiosError(error)
          ? error.code
          : undefined;
        const retryable = ['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(code || '');
        if (attempt === 0 && retryable) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        throw error;
      }
    }
    throw new Error('HERE route request exhausted retries');
  }
}
