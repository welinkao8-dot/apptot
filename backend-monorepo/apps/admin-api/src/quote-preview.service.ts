import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { HereRoutingProvider } from '../../../libs/routing/src/here-routing.provider';
import { QuotePreviewDto } from './quote-preview.dto';

const MAX_FARE = 99_999_999.99;

function calculateFare(pricing: { base_fare: unknown; price_per_km: unknown; price_per_min: unknown; min_fare: unknown }, distanceMeters: number, durationSeconds: number) {
  const [base, perKm, perMinute, minimum] = [pricing.base_fare, pricing.price_per_km, pricing.price_per_min, pricing.min_fare].map(Number);
  if ([base, perKm, perMinute, minimum].some(value => !Number.isFinite(value) || value < 0 || value > MAX_FARE)) {
    throw new BadRequestException('Os valores de preço devem ser números finitos e não negativos.');
  }
  const raw = base + perKm * (distanceMeters / 1000) + perMinute * (durationSeconds / 60);
  const fare = Math.max(minimum, Math.ceil(raw * 100) / 100);
  if (!Number.isFinite(fare) || fare <= 0 || fare > MAX_FARE) throw new BadRequestException('A simulação produz um preço fora do limite suportado.');
  return fare.toFixed(2);
}

@Injectable()
export class QuotePreviewService {
  constructor(private readonly prisma: PrismaService, private readonly router: HereRoutingProvider) {}

  async preview(id: number, input: QuotePreviewDto) {
    const validPoint = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -18.1 && lat <= -4.3 && lng >= 11.6 && lng <= 24.1;
    if (!validPoint(input.originLat, input.originLng) || !validPoint(input.destLat, input.destLng)) {
      throw new BadRequestException('A origem e o destino devem ser pontos válidos em Angola.');
    }
    const service = await this.prisma.service_configs.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Serviço não encontrado.');
    if (input.originLat === -8.839 && input.originLng === 13.289) {
      throw new BadRequestException('Selecione uma origem confirmada, não a localização inicial do mapa.');
    }
    const routeInput = { originLat: input.originLat, originLng: input.originLng, destLat: input.destLat, destLng: input.destLng };
    const route = await this.router.getRoute(routeInput, service.routing_mode as 'car' | 'scooter' | 'truck');
    if (!Number.isFinite(route.distanceMeters) || route.distanceMeters <= 0 || !Number.isFinite(route.durationSeconds) || route.durationSeconds <= 0) {
      throw new BadRequestException('O serviço de rotas devolveu uma distância ou duração inválida.');
    }
    return {
      serviceConfigId: service.id,
      serviceName: service.name,
      distanceMeters: Math.round(route.distanceMeters),
      durationSeconds: Math.round(route.durationSeconds),
      currentFare: calculateFare(service, route.distanceMeters, route.durationSeconds),
      proposedFare: calculateFare(input.proposed, route.distanceMeters, route.durationSeconds),
    };
  }
}
