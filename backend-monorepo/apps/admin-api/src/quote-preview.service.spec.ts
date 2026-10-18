import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotePreviewService } from './quote-preview.service';

describe('QuotePreviewService', () => {
  const currentService = { id: 7, name: 'Carro', vehicle_category: 'car', routing_mode: 'car', base_fare: 500, price_per_km: 100, price_per_min: 50, min_fare: 700 };
  const route = { distanceMeters: 10_000, durationSeconds: 1_200, polyline: 'route' };

  it('returns current and proposed fares for a real server-routed preview without persisting a quote', async () => {
    const prisma = { service_configs: { findUnique: jest.fn().mockResolvedValue(currentService) } };
    const router = { getRoute: jest.fn().mockResolvedValue(route) };
    const service = new QuotePreviewService(prisma as never, router as never);

    await expect(service.preview(7, {
      originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3,
      proposed: { base_fare: 600, price_per_km: 120, price_per_min: 60, min_fare: 800 },
    })).resolves.toEqual({
      serviceConfigId: 7, serviceName: 'Carro', distanceMeters: 10_000, durationSeconds: 1_200,
      currentFare: '2500.00', proposedFare: '3000.00',
    });
    expect(router.getRoute).toHaveBeenCalledWith({ originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3 }, 'car');
    expect(prisma.service_configs.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid coordinates and missing services before calling routing', async () => {
    const prisma = { service_configs: { findUnique: jest.fn().mockResolvedValue(null) } };
    const router = { getRoute: jest.fn() };
    const service = new QuotePreviewService(prisma as never, router as never);
    const input = { originLat: 0, originLng: 13, destLat: -8.9, destLng: 13.3, proposed: { base_fare: 1, price_per_km: 1, price_per_min: 1, min_fare: 1 } };
    await expect(service.preview(7, input)).rejects.toBeInstanceOf(BadRequestException);
    expect(router.getRoute).not.toHaveBeenCalled();
    await expect(service.preview(7, { ...input, originLat: -8.8 })).rejects.toBeInstanceOf(NotFoundException);
    expect(router.getRoute).not.toHaveBeenCalled();
  });
});
