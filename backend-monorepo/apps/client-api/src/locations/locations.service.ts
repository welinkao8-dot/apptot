import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

const HERE_GEOCODE_URL = 'https://geocode.search.hereapi.com/v1';
const DEFAULT_SEARCH_CENTER = { lat: -8.839, lng: 13.289 };

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  async autosuggest(query: string, lat?: number, lng?: number) {
    const normalizedQuery = typeof query === 'string' ? query.trim().slice(0, 120) : '';
    if (normalizedQuery.length < 3) return [];
    if ((lat === undefined) !== (lng === undefined) || (lat !== undefined && !this.validCenter(lat, lng))) {
      throw new BadRequestException('As coordenadas da pesquisa são inválidas.');
    }

    const apiKey = this.getApiKey();
    const center = this.validCenter(lat, lng) ? { lat, lng } : DEFAULT_SEARCH_CENTER;
    try {
      const response = await this.request(`${HERE_GEOCODE_URL}/autosuggest`, {
          q: normalizedQuery,
          apiKey,
          lang: 'pt',
          in: 'countryCode:AGO',
          limit: 5,
          show: 'details',
          at: `${center.lat},${center.lng}`,
      });

      return (Array.isArray(response.data?.items) ? response.data.items : []).map((item: any) => ({
        id: item.id,
        title: item.title,
        address: item.address,
        position: item.position,
      }));
    } catch (error) {
      this.logFailure('autosuggest', error);
      throw new ServiceUnavailableException('A pesquisa de endereços está temporariamente indisponível.');
    }
  }

  async reverseGeocode(lat: number, lng: number) {
    if (!this.validCenter(lat, lng)) throw new BadRequestException('As coordenadas do mapa são inválidas.');

    const apiKey = this.getApiKey();
    try {
      const response = await this.request(`${HERE_GEOCODE_URL}/revgeocode`, { at: `${lat},${lng}`, apiKey, lang: 'pt' });
      return response.data?.items?.[0]?.address?.label || null;
    } catch (error) {
      this.logFailure('reverse geocode', error);
      throw new ServiceUnavailableException('Não foi possível obter o endereço deste ponto.');
    }
  }

  mapConfig() {
    const apiKey = process.env.HERE_MAP_API_KEY?.trim();
    if (!apiKey) throw new ServiceUnavailableException('O serviço de mapa não está configurado.');
    return { apiKey };
  }

  private getApiKey() {
    const apiKey = process.env.HERE_API_KEY?.trim() || process.env.HERE_ROUTING_API_KEY?.trim();
    if (!apiKey) throw new ServiceUnavailableException('O serviço de pesquisa de endereços não está configurado.');
    return apiKey;
  }

  private validCenter(lat?: number, lng?: number): lat is number {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat! >= -90 && lat! <= 90 && lng! >= -180 && lng! <= 180;
  }

  private logFailure(operation: string, error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const code = axios.isAxiosError(error) ? error.code : undefined;
    this.logger.warn(`HERE ${operation} failed${status ? ` with HTTP ${status}` : ''}${code ? ` (${code})` : ''}.`);
  }

  private async request(url: string, params: Record<string, string | number>) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await axios.get(url, { params, timeout: 8000 });
      } catch (error) {
        const code = axios.isAxiosError(error) ? error.code : undefined;
        const retryable = ['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(code || '');
        if (attempt === 0 && retryable) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        throw error;
      }
    }
    throw new Error('HERE geocoding request exhausted retries');
  }
}
