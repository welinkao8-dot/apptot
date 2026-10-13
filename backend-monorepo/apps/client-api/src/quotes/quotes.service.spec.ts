import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';

describe('QuotesService', () => {
  it('calculates and stores a fare from HERE metrics and the active service pricing snapshot', async () => {
    const prisma = {
      service_configs: { findMany: jest.fn().mockResolvedValue([{ id: 4, category: 'ride', name: 'Carro', routing_mode: 'car', base_fare: 500, price_per_km: 100, price_per_min: 50, min_fare: 700 }]) },
      trip_quotes: { create: jest.fn().mockImplementation(({ data }) => ({ id: 'quote-1', ...data })) },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    const router = { getRoute: jest.fn().mockResolvedValue({ distanceMeters: 10_000, durationSeconds: 1_200, polyline: 'car-route' }) };
    const service = new QuotesService(prisma as never, router as never);

    const quote = await service.create('client-a', { serviceConfigId: 4, category: 'ride', originAddress: 'A', destAddress: 'B', originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3 });
    expect(quote[0].estimatedFare).toBe('2500.00');
    expect(prisma.trip_quotes.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        client_id: 'client-a', distance_meters: 10_000, duration_seconds: 1_200,
        pricing_snapshot: { baseFare: 500, pricePerKm: 100, pricePerMin: 50, minFare: 700, serviceConfigId: 4, serviceName: 'Carro', routingMode: 'car' },
        expires_at: expect.any(Date),
      }),
    }));
  });

  it('calculates each service with its configured transport mode and returns matching geometry', async () => {
    const services = [
      { id: 4, category: 'ride', name: 'Carro', routing_mode: 'car', base_fare: 500, price_per_km: 100, price_per_min: 50, min_fare: 700 },
      { id: 5, category: 'ride', name: 'Moto', routing_mode: 'scooter', base_fare: 300, price_per_km: 80, price_per_min: 20, min_fare: 500 },
    ];
    const prisma = {
      service_configs: { findMany: jest.fn().mockResolvedValue(services) },
      trip_quotes: { create: jest.fn().mockImplementation(({ data }) => ({ id: `quote-${data.service_config_id}`, ...data })) },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    const router = {
      getRoute: jest.fn(async (_coords: unknown, mode: string) => mode === 'scooter'
        ? { distanceMeters: 5_000, durationSeconds: 600, polyline: 'scooter-route' }
        : { distanceMeters: 10_000, durationSeconds: 1_200, polyline: 'car-route' }),
    };
    const service = new QuotesService(prisma as never, router as never);
    const dto = { category: 'ride' as const, originAddress: 'A', destAddress: 'B', originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3 };

    const quotes = await service.create('client-a', dto);

    expect(router.getRoute).toHaveBeenNthCalledWith(1, dto, 'car');
    expect(router.getRoute).toHaveBeenNthCalledWith(2, dto, 'scooter');
    expect(quotes.map(({ distanceMeters, estimatedFare, routePolyline }) => ({ distanceMeters, estimatedFare, routePolyline }))).toEqual([
      { distanceMeters: 10_000, estimatedFare: '2500.00', routePolyline: 'car-route' },
      { distanceMeters: 5_000, estimatedFare: '900.00', routePolyline: 'scooter-route' },
    ]);
  });

  it('rejects a service with an unsupported routing mode instead of quoting it as a car', async () => {
    const prisma = { service_configs: { findMany: jest.fn().mockResolvedValue([
      { id: 4, category: 'ride', name: 'Unknown', routing_mode: 'spaceship', base_fare: 1, price_per_km: 1, price_per_min: 1, min_fare: 1 },
    ]) } };
    const router = { getRoute: jest.fn() };
    const service = new QuotesService(prisma as never, router as never);

    await expect(service.create('client-a', { category: 'ride', originAddress: 'A', destAddress: 'B', originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(router.getRoute).not.toHaveBeenCalled();
  });

  it('rejects a moto service configured with car roads instead of silently quoting it', async () => {
    const prisma = { service_configs: { findMany: jest.fn().mockResolvedValue([
      { id: 6, category: 'ride', name: 'Moto', vehicle_category: 'moto', routing_mode: 'car', base_fare: 1, price_per_km: 1, price_per_min: 1, min_fare: 1 },
    ]) } };
    const router = { getRoute: jest.fn() };
    const service = new QuotesService(prisma as never, router as never);

    await expect(service.create('client-a', { category: 'ride', originAddress: 'A', destAddress: 'B', originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(router.getRoute).not.toHaveBeenCalled();
  });

  it('rejects a category with no available service configuration', async () => {
    const prisma = { service_configs: { findMany: jest.fn().mockResolvedValue([]) } };
    const router = { getRoute: jest.fn() };
    const service = new QuotesService(prisma as never, router as never);
    await expect(service.create('client-a', { category: 'ride', originAddress: 'A', destAddress: 'B', originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3 })).rejects.toBeInstanceOf(NotFoundException);
    expect(router.getRoute).not.toHaveBeenCalled();
  });

  it('rejects zero, placeholder and out-of-Angola quote coordinates before routing', async () => {
    const prisma = { service_configs: { findMany: jest.fn() } };
    const router = { getRoute: jest.fn() };
    const service = new QuotesService(prisma as never, router as never);
    for (const coords of [
      { originLat: 0, originLng: 0, destLat: -8.9, destLng: 13.3 },
      { originLat: -8.839, originLng: 13.289, destLat: -8.9, destLng: 13.3 },
      { originLat: 1, originLng: 1, destLat: 2, destLng: 2 },
    ]) {
      await expect(service.create('client-a', { category: 'ride', originAddress: 'A', destAddress: 'B', ...coords }))
        .rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.service_configs.findMany).not.toHaveBeenCalled();
    expect(router.getRoute).not.toHaveBeenCalled();
  });

  it('requires recipient and parcel details for a delivery quote', async () => {
    const service = new QuotesService({} as never, { getRoute: jest.fn() } as never);
    await expect(service.create('client-a', { category: 'delivery', originAddress: 'A', destAddress: 'B', originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3 })).rejects.toBeInstanceOf(BadRequestException);
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
