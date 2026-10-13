import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
        findFirst: jest.fn().mockResolvedValue({ id: 'trip-a', status: 'requested', origin_lat: -8.84, origin_lng: 13.29 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      drivers: { findMany: jest.fn().mockResolvedValue([
        { id: 'far', current_lat: -8.9, current_lng: 13.5 },
        { id: 'near', current_lat: -8.841, current_lng: 13.291 },
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

  it('creates a trip from a single-use owned quote instead of payload pricing', async () => {
    const quote = { id: 'quote-a', client_id: 'client-a', origin_address: 'A', origin_lat: 1, origin_lng: 2, dest_address: 'B', dest_lat: 3, dest_lng: 4, estimated_fare: '950.00', service_config_id: 3, category: 'ride', delivery_info: null };
    const tx = {
      trip_quotes: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(quote),
      },
      trips: { create: jest.fn().mockResolvedValue({ id: 'trip-a', estimated_fare: '950.00' }) },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new TripsService(prisma as never);

    await service.create({ quoteId: 'quote-a', price: '1' } as never, 'client-a');
    expect(tx.trip_quotes.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'quote-a', client_id: 'client-a', consumed_at: null }) }));
    expect(tx.trips.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quote_id: 'quote-a', estimated_fare: '950.00' }) }));
  });

  it('rejects a losing driver when two drivers race to accept one trip', async () => {
    const tx = {
      trip_driver_offers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      trips: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
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

  it('claims the offer, trip and remaining-offer cancellation in one transaction', async () => {
    const tx = {
      trip_driver_offers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', driver_id: 'driver-a', status: 'accepted' }),
      },
    };
    const prisma = { trip_driver_offers: { updateMany: jest.fn() }, $transaction: jest.fn((callback) => callback(tx)) };
    const service = new TripsService(prisma as never);
    await expect(service.accept('trip-a', 'driver-a')).resolves.toMatchObject({ status: 'accepted' });
    expect(tx.trip_driver_offers.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.trips.updateMany).toHaveBeenCalledTimes(1);
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
