import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';

describe('QuotesService', () => {
  it('calculates and stores a fare from HERE metrics and the active service pricing snapshot', async () => {
    const prisma = {
      service_configs: { findMany: jest.fn().mockResolvedValue([{ id: 4, category: 'ride', name: 'Carro', base_fare: 500, price_per_km: 100, price_per_min: 50, min_fare: 700 }]) },
      trip_quotes: { create: jest.fn().mockImplementation(({ data }) => ({ id: 'quote-1', ...data })) },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    const router = { getRoute: jest.fn().mockResolvedValue({ distanceMeters: 10_000, durationSeconds: 1_200 }) };
    const service = new QuotesService(prisma as never, router as never);

    const quote = await service.create('client-a', { serviceConfigId: 4, category: 'ride', originAddress: 'A', destAddress: 'B', originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3 });
    expect(quote[0].estimatedFare).toBe('2500.00');
    expect(prisma.trip_quotes.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        client_id: 'client-a', distance_meters: 10_000, duration_seconds: 1_200,
        pricing_snapshot: { baseFare: 500, pricePerKm: 100, pricePerMin: 50, minFare: 700, serviceConfigId: 4, serviceName: 'Carro' },
        expires_at: expect.any(Date),
      }),
    }));
  });

  it('rejects a category with no available service configuration', async () => {
    const prisma = { service_configs: { findMany: jest.fn().mockResolvedValue([]) } };
    const router = { getRoute: jest.fn() };
    const service = new QuotesService(prisma as never, router as never);
    await expect(service.create('client-a', { category: 'ride', originAddress: 'A', destAddress: 'B', originLat: 1, originLng: 1, destLat: 2, destLng: 2 })).rejects.toBeInstanceOf(NotFoundException);
    expect(router.getRoute).not.toHaveBeenCalled();
  });

  it('requires recipient and parcel details for a delivery quote', async () => {
    const service = new QuotesService({} as never, { getRoute: jest.fn() } as never);
    await expect(service.create('client-a', { category: 'delivery', originAddress: 'A', destAddress: 'B', originLat: 1, originLng: 1, destLat: 2, destLng: 2 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the persisted quote owner to match the trip owner at consumption', async () => {
    const tx = {
      trip_quotes: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ client_id: 'client-a' }),
      },
    };
    const service = new QuotesService({} as never, {} as never);
    await expect(service.consume('quote-1', 'client-b', tx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['expired', new Date(Date.now() - 1000), null],
    ['already consumed', new Date(Date.now() + 60_000), new Date()],
  ])('rejects a %s quote', async (_state, expiresAt, consumedAt) => {
    const tx = {
      trip_quotes: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ client_id: 'client-a', expires_at: expiresAt, consumed_at: consumedAt }),
      },
    };
    const service = new QuotesService({} as never, {} as never);
    await expect(service.consume('quote-1', 'client-a', tx)).rejects.toBeInstanceOf(BadRequestException);
  });
});
