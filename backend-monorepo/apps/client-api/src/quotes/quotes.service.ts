import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { consumeTripQuote, PrismaService } from '@app/database';
import { Prisma } from '@prisma/client';
import { CreateQuoteDto } from './quote.dto';
import { HereRoutingProvider, HereTransportMode } from './here-routing.provider';

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService, private readonly router: HereRoutingProvider) {}

  async create(clientId: string, dto: CreateQuoteDto) {
    if (!dto.originAddress?.trim() || !dto.destAddress?.trim()) {
      throw new BadRequestException('A origem e o destino são obrigatórios.');
    }
    const validAngolaPoint = (lat: number, lng: number) =>
      Number.isFinite(lat) && Number.isFinite(lng) && lat >= -18.1 && lat <= -4.3 && lng >= 11.6 && lng <= 24.1;
    if (!validAngolaPoint(dto.originLat, dto.originLng) || !validAngolaPoint(dto.destLat, dto.destLng)
      || (dto.originLat === -8.839 && dto.originLng === 13.289)) {
      throw new BadRequestException('Confirme um ponto de origem e destino válido em Angola antes de pedir a cotação.');
    }
    if (dto.category === 'delivery') {
      const info = dto.deliveryInfo;
      if (!info || !String(info.recipientName ?? '').trim() || !String(info.recipientPhone ?? '').trim() || !String(info.packageDescription ?? '').trim()) {
        throw new BadRequestException('Os dados do destinatário e da encomenda são obrigatórios.');
      }
    }
    const services = await this.prisma.service_configs.findMany({
      where: { category: dto.category },
      orderBy: { id: 'asc' },
    });
    if (services.length === 0) throw new NotFoundException('Nenhum serviço disponível para esta categoria.');

    const routingModes = services.map((service) => this.routingModeFor(service.routing_mode, service.vehicle_category));
    const uniqueModes = [...new Set(routingModes)];
    const routes = await Promise.all(uniqueModes.map(async (mode) => [mode, await this.router.getRoute(dto, mode)] as const));
    const routeByMode = new Map<HereTransportMode, Awaited<ReturnType<HereRoutingProvider['getRoute']>>>(routes);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const quoteDrafts = services.map((service, index) => {
      const routingMode = routingModes[index];
      const route = routeByMode.get(routingMode);
      if (!route) throw new BadRequestException('Não foi possível calcular a rota para este serviço.');
      const distanceKm = route.distanceMeters / 1000;
      const durationMinutes = route.durationSeconds / 60;
      const rawFare = Number(service.base_fare)
        + Number(service.price_per_km) * distanceKm
        + Number(service.price_per_min) * durationMinutes;
      const fare = Math.max(Number(service.min_fare), Math.ceil(rawFare * 100) / 100);
      if (!Number.isFinite(fare) || fare <= 0) throw new BadRequestException('A configuração de preços não produz uma tarifa válida.');

      return {
        service,
        data: {
          client_id: clientId,
          service_config_id: service.id,
          category: dto.category,
          origin_address: dto.originAddress,
          origin_lat: dto.originLat,
          origin_lng: dto.originLng,
          dest_address: dto.destAddress,
          dest_lat: dto.destLat,
          dest_lng: dto.destLng,
          delivery_info: dto.deliveryInfo as Prisma.InputJsonValue | undefined,
          distance_meters: Math.round(route.distanceMeters),
          duration_seconds: Math.round(route.durationSeconds),
          estimated_fare: fare.toFixed(2),
          pricing_snapshot: {
            baseFare: Number(service.base_fare),
            pricePerKm: Number(service.price_per_km),
            pricePerMin: Number(service.price_per_min),
            minFare: Number(service.min_fare),
            serviceConfigId: service.id,
            serviceName: service.name,
            routingMode,
          },
          expires_at: expiresAt,
        },
      };
    });
    const createdQuotes = await this.prisma.$transaction(
      quoteDrafts.map(({ data }) => this.prisma.trip_quotes.create({ data })),
    );

    return createdQuotes.map((quote, index) => {
      const service = quoteDrafts[index].service;
      return {
        id: quote.id,
        serviceConfigId: service.id,
        serviceName: service.name,
        category: quote.category,
        distanceMeters: quote.distance_meters,
        durationSeconds: quote.duration_seconds,
        estimatedFare: quote.estimated_fare.toString(),
        expiresAt: quote.expires_at,
        routePolyline: routeByMode.get(routingModes[index])?.polyline,
      };
    });
  }

  async consume(quoteId: string, clientId: string, tx: any) {
    return consumeTripQuote(tx, quoteId, clientId);
  }

  private routingModeFor(value: unknown, vehicleCategory?: unknown): HereTransportMode {
    const mode = value === 'car' || value === 'scooter' || value === 'truck' ? value : null;
    const category = String(vehicleCategory ?? '').toLowerCase();
    const expected: HereTransportMode | null = /moto|motorcycle|scooter|bike/.test(category)
      ? 'scooter'
      : /truck|caminh|van/.test(category)
        ? 'truck'
        : /car|automovel|automóvel/.test(category)
          ? 'car'
          : null;
    if (mode && (!expected || expected === mode)) return mode;
    throw new BadRequestException('O serviço possui um modo de roteamento inválido. Configure car, scooter ou truck.');
  }
}
