import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TripsService } from './trips.service';

describe('TripsService driver availability', () => {
  it('does not allow suspended drivers to go online', async () => {
    const prisma = {
      drivers: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new TripsService(prisma as never);

    await expect(service.updateDriverStatus('driver-a', true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.drivers.updateMany).toHaveBeenCalledWith({
      where: { id: 'driver-a', status: 'active' },
      data: { is_online: true },
    });
  });

  it('allows active drivers to change availability', async () => {
    const prisma = {
      drivers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new TripsService(prisma as never);

    await expect(service.updateDriverStatus('driver-a', true)).resolves.toEqual({ count: 1 });
  });
});

describe('TripsService driver location persistence', () => {
  it('persists validated GPS accuracy with coordinates and server receive time', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'driver-a' });
    const service = new TripsService({ drivers: { update } } as never);
    const before = Date.now();

    await expect(service.updateDriverLocation('driver-a', -8.9, 13.2, 7.5)).resolves.toEqual({ id: 'driver-a' });

    const call = update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'driver-a' });
    expect(call.data).toMatchObject({ current_lat: -8.9, current_lng: 13.2, current_accuracy: 7.5 });
    expect(call.data.last_location_update.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('TripsService trip lifecycle', () => {
  it('formats persisted route estimates and coordinates without invented pickup data', () => {
    const service = new TripsService({} as never);
    const trip = service.formatTrip({
      id: 'trip-a', origin_lat: 0, origin_lng: 0, dest_lat: -8.9, dest_lng: 13.2,
      trip_quotes: { distance_meters: 5200, duration_seconds: 601 },
    });
    expect(trip).toMatchObject({
      coords: { lat: 0, lng: 0 },
      destPos: { lat: -8.9, lng: 13.2 },
      routeDistanceKm: 5.2,
      routeDurationMinutes: 11,
    });
    expect(trip.coords).not.toMatchObject({ lat: -8.839, lng: 13.289 });
  });

  it('records a driver declining only their own currently active offer', async () => {
    const prisma = { trip_driver_offers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new TripsService(prisma as never);
    await expect(service.declineOffer('trip-a', 'driver-a')).resolves.toEqual({ success: true });
    expect(prisma.trip_driver_offers.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { trip_id: 'trip-a', driver_id: 'driver-a', status: 'offered', expires_at: { gt: expect.any(Date) } },
      data: { status: 'rejected', responded_at: expect.any(Date) },
    }));
  });

  it('returns pending requests only while that driver has a live persisted offer', async () => {
    const prisma = { trips: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new TripsService(prisma as never);
    await service.findAllPending('driver-a');
    expect(prisma.trips.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ driver_offers: { some: expect.objectContaining({ driver_id: 'driver-a', status: 'offered', expires_at: { gt: expect.any(Date) } }) } }),
      include: expect.objectContaining({ driver_offers: { where: expect.objectContaining({ driver_id: 'driver-a', status: 'offered' }), select: { expires_at: true } } }),
    }));
  });

  it('persists offers only for the nearest eligible connected drivers', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn(),
      trips: {
        findFirst: jest.fn().mockResolvedValue({ id: 'trip-a', status: 'requested', origin_lat: -8.84, origin_lng: 13.29, service_configs: { routing_mode: 'car' } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      drivers: { findMany: jest.fn().mockResolvedValue([
        { id: 'far', vehicle_category: 'car', current_lat: -8.9, current_lng: 13.5 },
        { id: 'near', vehicle_category: 'car', current_lat: -8.841, current_lng: 13.291 },
      ]) },
      trip_driver_offers: {
        updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new TripsService(prisma as never);
    const offered = await service.dispatchNextBatch('trip-a', ['near', 'far'], 1);
    expect(offered.map(({ driverId }) => driverId)).toEqual(['near']);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', 'trip-a');
    expect(tx.trip_driver_offers.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ trip_id: 'trip-a', driver_id: 'near', status: 'offered' })],
    }));
  });

  it('dispatches to eligible online drivers even when no driver socket is connected', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn(),
      trips: {
        findFirst: jest.fn().mockResolvedValue({ id: 'trip-a', status: 'requested', origin_lat: -8.84, origin_lng: 13.29, service_configs: { routing_mode: 'car' } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      drivers: { findMany: jest.fn().mockResolvedValue([{ id: 'sleeping-driver', vehicle_category: 'car', current_lat: -8.841, current_lng: 13.291 }]) },
      trip_driver_offers: { updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn() },
    };
    const service = new TripsService({ $transaction: jest.fn((callback) => callback(tx)) } as never);

    const offers = await service.dispatchNextBatch('trip-a', []);

    expect(offers.map(({ driverId }) => driverId)).toEqual(['sleeping-driver']);
    expect(tx.drivers.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'active', is_online: true }),
    }));
  });

  it('offers a service only to active drivers with the matching vehicle category', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn(),
      trips: {
        findFirst: jest.fn().mockResolvedValue({ id: 'trip-moto', status: 'requested', origin_lat: -8.84, origin_lng: 13.29, service_configs: { routing_mode: 'scooter' } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      drivers: { findMany: jest.fn().mockResolvedValue([
        { id: 'car-driver', vehicle_category: 'car', current_lat: -8.84, current_lng: 13.29 },
        { id: 'moto-driver', vehicle_category: 'moto', current_lat: -8.85, current_lng: 13.30 },
        { id: 'unclassified', vehicle_category: null, current_lat: -8.84, current_lng: 13.29 },
      ]) },
      trip_driver_offers: {
        updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn(),
      },
    };
    const service = new TripsService({ $transaction: jest.fn(callback => callback(tx)) } as never);

    const offers = await service.dispatchNextBatch('trip-moto', ['car-driver', 'moto-driver', 'unclassified']);

    expect(tx.drivers.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ vehicle_category: 'moto' }),
      select: expect.objectContaining({ vehicle_category: true }),
    }));
    expect(offers.map(({ driverId }) => driverId)).toEqual(['moto-driver']);
  });

  it('creates a trip from a single-use owned quote instead of payload pricing', async () => {
    const quote = { id: 'quote-a', client_id: 'client-a', origin_address: 'A', origin_lat: 1, origin_lng: 2, dest_address: 'B', dest_lat: 3, dest_lng: 4, estimated_fare: '950.00', service_config_id: 3, category: 'ride', delivery_info: null };
    const tx = {
      $queryRaw: jest.fn(),
      trip_quotes: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(quote),
      },
      trips: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'trip-a', estimated_fare: '950.00' }) },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new TripsService(prisma as never);

    await service.create({ quoteId: 'quote-a', price: '1' } as never, 'client-a');
    expect(tx.trip_quotes.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'quote-a', client_id: 'client-a', consumed_at: null }) }));
    expect(tx.trips.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quote_id: 'quote-a', estimated_fare: '950.00' }) }));
  });

  it('serializes socket trip creation and rejects an active client trip before consuming another quote', async () => {
    const operations: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async () => { operations.push('client-lock'); }),
      trips: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(async () => { operations.push('active-check'); return { id: 'trip-live', status: 'ongoing' }; }),
        create: jest.fn(),
      },
      trip_quotes: { updateMany: jest.fn(), findUnique: jest.fn() },
    };
    const service = new TripsService({ $transaction: jest.fn(callback => callback(tx)) } as never);

    await expect(service.create({ quoteId: 'quote-new' } as never, 'client-a')).rejects.toBeInstanceOf(ConflictException);

    expect(operations).toEqual(['client-lock', 'active-check']);
    expect(tx.trips.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      client_id: 'client-a',
      OR: expect.arrayContaining([
        { status: { in: ['requested', 'accepted', 'ongoing'] } },
        { status: 'completed', trip_payment: { is: { status: 'pending' } } },
      ]),
    }) }));
    expect(tx.trip_quotes.updateMany).not.toHaveBeenCalled();
    expect(tx.trips.create).not.toHaveBeenCalled();
  });

  it('returns the same trip when a socket request retries its already-consumed quote', async () => {
    const existing = { id: 'trip-existing', client_id: 'client-a', quote_id: 'quote-a', status: 'requested' };
    const tx = {
      $queryRaw: jest.fn(),
      trips: { findUnique: jest.fn().mockResolvedValue(existing), findFirst: jest.fn(), create: jest.fn() },
      trip_quotes: { updateMany: jest.fn(), findUnique: jest.fn() },
    };
    const service = new TripsService({ $transaction: jest.fn(callback => callback(tx)) } as never);

    await expect(service.create({ quoteId: 'quote-a' } as never, 'client-a')).resolves.toMatchObject(existing);

    expect(tx.trips.findFirst).not.toHaveBeenCalled();
    expect(tx.trip_quotes.updateMany).not.toHaveBeenCalled();
    expect(tx.trips.create).not.toHaveBeenCalled();
  });

  it('rejects a losing driver when two drivers race to accept one trip', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'driver-b', status: 'active', is_online: true }]),
      trip_driver_offers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'trip-a', driver_id: null, status: 'requested' })
          .mockResolvedValueOnce({ id: 'trip-a', driver_id: 'driver-a', status: 'accepted' }),
      },
    };
    const prisma = {
      trip_driver_offers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new TripsService(prisma as never);

    await expect(service.accept('trip-a', 'driver-b')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.trips.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'trip-a', driver_id: null, status: { in: ['requested'] } },
    }));
  });

  it.each([
    ['suspended', true],
    ['active', false],
  ])('locks the driver and rejects acceptance for a %s driver with online=%s', async (status, isOnline) => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'driver-a', status, is_online: isOnline }]),
      trips: { findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', driver_id: null, status: 'requested' }) },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new TripsService(prisma as never);

    await expect(service.accept('trip-a', 'driver-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.trips.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id, status, is_online FROM drivers WHERE id = $1::uuid FOR UPDATE',
      'driver-a',
    );
    expect(tx.trips.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'trip-a' } }));
  });

  it.each([
    ['accepted', null],
    ['ongoing', null],
    ['completed', 'pending'],
  ])('rejects a new acceptance while the driver has a %s trip with payment %s', async (status, paymentStatus) => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'driver-a', status: 'active', is_online: true }]),
      trips: {
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', driver_id: null, status: 'requested' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'trip-busy' }),
      },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new TripsService(prisma as never);

    await expect(service.accept('trip-a', 'driver-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(tx.trips.findFirst).toHaveBeenCalledWith({
      where: {
        driver_id: 'driver-a',
        OR: [
          { status: { in: ['accepted', 'ongoing'] } },
          { status: 'completed', trip_payment: { is: { status: 'pending' } } },
        ],
      },
      select: { id: true },
    });
  });

  it('claims the offer, trip and remaining-offer cancellation in one transaction', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'driver-a', status: 'active', is_online: true }]),
      trip_driver_offers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'trip-a', driver_id: null, status: 'requested' })
          .mockResolvedValueOnce({ id: 'trip-a', driver_id: 'driver-a', status: 'accepted' }),
      },
    };
    const prisma = { trip_driver_offers: { updateMany: jest.fn() }, $transaction: jest.fn((callback) => callback(tx)) };
    const service = new TripsService(prisma as never);
    await expect(service.accept('trip-a', 'driver-a')).resolves.toMatchObject({ status: 'accepted' });
    expect(tx.trip_driver_offers.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.trip_driver_offers.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { trip_id: 'trip-a', driver_id: 'driver-a', status: 'offered', expires_at: { gt: expect.any(Date) } },
      data: { status: 'accepted', responded_at: expect.any(Date) },
    }));
    expect(tx.trip_driver_offers.updateMany).toHaveBeenNthCalledWith(2, {
      where: { trip_id: 'trip-a', status: 'offered' },
      data: { status: 'cancelled', responded_at: expect.any(Date) },
    });
    expect(tx.trips.updateMany).toHaveBeenCalledTimes(1);
  });

  it('treats a repeated accept ACK as success for the driver who already claimed the trip', async () => {
    const assignedTrip = { id: 'trip-a', driver_id: 'driver-a', status: 'accepted' };
    const winningTx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'driver-a', status: 'active', is_online: true }]),
      trip_driver_offers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'trip-a', driver_id: null, status: 'requested' })
          .mockResolvedValueOnce(assignedTrip),
      },
    };
    const retryTx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'driver-a', status: 'active', is_online: true }]),
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(assignedTrip),
      },
    };
    const prisma = {
      trip_driver_offers: { updateMany: jest.fn() },
      $transaction: jest.fn()
        .mockImplementationOnce(callback => callback(winningTx))
        .mockImplementationOnce(callback => callback(retryTx)),
    };
    const service = new TripsService(prisma as never);

    await expect(service.accept('trip-a', 'driver-a')).resolves.toMatchObject({ status: 'accepted', driver_id: 'driver-a' });
    await expect(service.accept('trip-a', 'driver-a')).resolves.toMatchObject({ status: 'accepted', driver_id: 'driver-a' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(retryTx.trips.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'trip-a' } }));
    expect(retryTx.trips.updateMany).not.toHaveBeenCalled();
    expect(prisma.trip_driver_offers.updateMany).not.toHaveBeenCalled();
  });

  it('rejects another driver retrying after the winning driver claimed the trip', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'driver-b', status: 'active', is_online: true }]),
      trip_driver_offers: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'trip-a' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', driver_id: 'driver-a', status: 'accepted' }),
      },
    };
    const prisma = { trip_driver_offers: { updateMany: jest.fn() }, $transaction: jest.fn(callback => callback(tx)) };
    const service = new TripsService(prisma as never);

    await expect(service.accept('trip-a', 'driver-b')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.trips.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'trip-a' } }));
  });

  it('does not let an expired offer claim an unassigned trip', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'driver-a', status: 'active', is_online: true }]),
      trip_driver_offers: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'trip-a', driver_id: null, status: 'requested' })
          .mockResolvedValueOnce({ id: 'trip-a', driver_id: null, status: 'requested' }),
      },
    };
    const prisma = { trip_driver_offers: { updateMany: jest.fn() }, $transaction: jest.fn(callback => callback(tx)) };
    const service = new TripsService(prisma as never);

    await expect(service.accept('trip-a', 'driver-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.trips.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'trip-a', driver_id: null, status: { in: ['requested'] } },
    }));
    expect(tx.trip_driver_offers.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ trip_id: 'trip-a', driver_id: 'driver-a', status: 'offered', expires_at: { gt: expect.any(Date) } }),
      data: { status: 'accepted', responded_at: expect.any(Date) },
    }));
    expect(prisma.trip_driver_offers.updateMany).not.toHaveBeenCalled();
  });

  it('cancels only a trip owned by the actor while it is before the ride starts', async () => {
    const tx = {
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', client_id: 'client-a', driver_id: null, status: 'cancelled' }),
      },
      trip_driver_offers: { updateMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new TripsService(prisma as never);

    await service.cancel('trip-a', { role: 'client', id: 'client-a' });
    expect(tx.trips.updateMany).toHaveBeenCalledWith({
      where: { id: 'trip-a', client_id: 'client-a', status: { in: ['requested', 'accepted'] } },
      data: { status: 'cancelled' },
    });
    expect(tx.trip_driver_offers.updateMany).toHaveBeenCalledWith({
      where: { trip_id: 'trip-a', status: { in: ['offered', 'accepted'] } },
      data: { status: 'cancelled', responded_at: expect.any(Date) },
    });
  });

  it('starts only an accepted trip assigned to that driver', async () => {
    const prisma = {
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', status: 'ongoing' }),
      },
    };
    const service = new TripsService(prisma as never);

    await service.start('trip-a', 'driver-a');
    expect(prisma.trips.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'trip-a', driver_id: 'driver-a', status: { in: ['accepted'] } },
      data: expect.objectContaining({ status: 'ongoing' }),
    }));
  });

  it('rejects cancellation after a trip has started', async () => {
    const tx = { trips: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new TripsService(prisma as never);
    await expect(service.cancel('trip-a', { role: 'driver', id: 'driver-a' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not replace the quoted fare with a driver supplied amount when finishing', async () => {
    const tx = {
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', client_id: 'client-a', estimated_fare: '1250.00', final_fare: '1250.00', category: 'ride' }),
        update: jest.fn(),
      },
      invoices: { findFirst: jest.fn().mockResolvedValue({ id: 'invoice-a' }), create: jest.fn() },
      trip_payments: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new TripsService(prisma as never);

    await service.finish('trip-a', 'driver-a', '1');
    expect(tx.trips.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'trip-a', driver_id: 'driver-a', status: { in: ['ongoing'] } },
      data: expect.objectContaining({ status: 'completed', payment_method: 'cash' }),
    }));
    expect(tx.trips.update).toHaveBeenCalledWith({ where: { id: 'trip-a' }, data: { final_fare: '1250.00' } });
  });

  it('creates a pending cash payment separately from the invoice when the trip finishes', async () => {
    const tx = {
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', client_id: 'client-a', estimated_fare: '1250.00', category: 'ride' }),
        update: jest.fn(),
      },
      invoices: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      trip_payments: { create: jest.fn() },
    };
    const service = new TripsService({ $transaction: jest.fn(callback => callback(tx)) } as never);

    await service.finish('trip-a', 'driver-a');
    expect(tx.invoices.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: '1250.00' }) }));
    expect(tx.trip_payments.create).toHaveBeenCalledWith({
      data: { trip_id: 'trip-a', method: 'cash', amount: '1250.00', status: 'pending' },
    });
  });

  it('returns the existing completed trip instead of creating a duplicate payment after a lost finish ACK', async () => {
    const completed = { id: 'trip-a', driver_id: 'driver-a', status: 'completed', final_fare: '1250.00' };
    const tx = {
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(completed),
      },
      trip_payments: { findUnique: jest.fn().mockResolvedValue({ status: 'pending', method: 'cash' }), create: jest.fn() },
    };
    const service = new TripsService({ $transaction: jest.fn(callback => callback(tx)) } as never);

    await expect(service.finish('trip-a', 'driver-a')).resolves.toEqual(completed);
    expect(tx.trip_payments.create).not.toHaveBeenCalled();
  });

  it('restores a completed trip that still has an unpaid cash payment for the driver', async () => {
    const prisma = { trips: { findFirst: jest.fn().mockResolvedValue({ id: 'trip-a' }) } };
    const service = new TripsService(prisma as never);
    await service.findActiveByDriver('driver-a');
    expect(prisma.trips.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        driver_id: 'driver-a',
        OR: [
          { status: { in: ['accepted', 'ongoing'] } },
          { status: 'completed', trip_payment: { is: { status: 'pending' } } },
        ],
      },
    }));
  });

  it('restores a completed trip that still has an unpaid cash payment for the client socket', async () => {
    const prisma = { trips: { findFirst: jest.fn().mockResolvedValue({ id: 'trip-a' }) } };
    const service = new TripsService(prisma as never);
    await service.findActiveByClient('client-a');
    expect(prisma.trips.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        client_id: 'client-a',
        OR: [
          { status: { in: ['requested', 'accepted', 'ongoing'] } },
          { status: 'completed', trip_payment: { is: { status: 'pending' } } },
        ],
      },
    }));
  });

  it('does not treat the literal all as a persisted trip status filter', async () => {
    const prisma = { trips: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new TripsService(prisma as never);
    await service.getHistory('driver-a', 'driver', 20, 'all');
    expect(prisma.trips.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { driver_id: 'driver-a' } }));
  });
});

describe('TripsService concurrent acceptance lock ordering', () => {
  it('claims the trip before changing offers so accept and cancel lock rows in the same order', async () => {
    const operations: string[] = [];
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'driver-a', status: 'active', is_online: true }]),
      trips: {
        updateMany: jest.fn(async () => { operations.push('trip'); return { count: 1 }; }),
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'trip-a', client_id: 'client-a', driver_id: null, status: 'requested' })
          .mockResolvedValueOnce({ id: 'trip-a', client_id: 'client-a', driver_id: 'driver-a', status: 'accepted' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      trip_driver_offers: {
        updateMany: jest.fn(async () => { operations.push('offers'); return { count: 1 }; }),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new TripsService(prisma as never);

    await service.accept('trip-a', 'driver-a');

    expect(operations.slice(0, 2)).toEqual(['trip', 'offers']);
  });
});
