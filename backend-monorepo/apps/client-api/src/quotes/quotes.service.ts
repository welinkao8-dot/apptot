import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { consumeTripQuote, PrismaService } from '@app/database';
import { Prisma } from '@prisma/client';
import { CreateQuoteDto } from './quote.dto';
import { HereRoutingProvider } from './here-routing.provider';

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService, private readonly router: HereRoutingProvider) {}

  async create(clientId: string, dto: CreateQuoteDto) {
    if (!dto.originAddress?.trim() || !dto.destAddress?.trim()) {
      throw new BadRequestException('A origem e o destino são obrigatórios.');
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

    const route = await this.router.getRoute(dto);
    const distanceKm = route.distanceMeters / 1000;
    const durationMinutes = route.durationSeconds / 60;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const quoteDrafts = services.map((service) => {
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
        routePolyline: route.polyline,
      };
    });
  }

  async consume(quoteId: string, clientId: string, tx: any) {
    return consumeTripQuote(tx, quoteId, clientId);
  }
}
