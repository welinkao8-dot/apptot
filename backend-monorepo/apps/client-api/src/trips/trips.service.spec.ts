import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TripsService } from './trips.service';

describe('TripsService', () => {
  it('rejects cancellation when the persisted trip belongs to another client', async () => {
    const tx = {
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-b', client_id: 'client-b' }),
      },
      trip_driver_offers: { updateMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new TripsService(prisma as never, {} as never);

    await expect(service.cancel('trip-b', 'client-a')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not cancel an owned trip once its persisted status is no longer cancellable', async () => {
    const tx = {
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', client_id: 'client-a' }),
      },
      trip_driver_offers: { updateMany: jest.fn() },
    };
    const service = new TripsService({ $transaction: jest.fn(callback => callback(tx)) } as never, {} as never);

    await expect(service.cancel('trip-a', 'client-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.trip_driver_offers.updateMany).not.toHaveBeenCalled();
  });

  it('creates a trip from the owned quote and its persisted fare, ignoring client price fields', async () => {
    const quote = { id: 'quote-a', origin_address: 'A', origin_lat: 1, origin_lng: 2, dest_address: 'B', dest_lat: 3, dest_lng: 4, estimated_fare: '950.00', service_config_id: 3, category: 'ride', delivery_info: null };
    const tx = { $queryRaw: jest.fn(), trips: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'trip-a', estimated_fare: '950.00' }) } };
    const prisma = { trips: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn(callback => callback(tx)) };
    const quotes = { consume: jest.fn().mockResolvedValue(quote) };
    const service = new TripsService(prisma as never, quotes as never);

    await service.create({ quoteId: 'quote-a', price: '1' } as never, 'client-a');
    expect(quotes.consume).toHaveBeenCalledWith('quote-a', 'client-a', tx);
    expect(tx.trips.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quote_id: 'quote-a', estimated_fare: '950.00', client_id: 'client-a' }),
    }));
  });

  it('returns the already-created trip when the same quote is retried after an ACK loss', async () => {
    const existing = { id: 'trip-existing', client_id: 'client-a', quote_id: 'quote-a' };
    const tx = { $queryRaw: jest.fn(), trips: { findUnique: jest.fn().mockResolvedValue(existing), findFirst: jest.fn(), create: jest.fn() } };
    const prisma = { $transaction: jest.fn(callback => callback(tx)), trips: { findUnique: jest.fn() } };
    const quotes = { consume: jest.fn() };
    const service = new TripsService(prisma as never, quotes as never);
    await expect(service.create({ quoteId: 'quote-a' } as never, 'client-a')).resolves.toBe(existing);
    expect(quotes.consume).not.toHaveBeenCalled();
    expect(tx.trips.create).not.toHaveBeenCalled();
  });

  it('serializes client trip creation and rejects another active trip including pending payment', async () => {
    const activeTrip = { id: 'trip-pending-payment', client_id: 'client-a', status: 'completed' };
    const operations: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async () => { operations.push('client-lock'); }),
      trips: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(async (query) => { operations.push('active-check'); return activeTrip; }),
        create: jest.fn(),
      },
    };
    const prisma = { trips: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn(callback => callback(tx)) };
    const quotes = { consume: jest.fn() };
    const service = new TripsService(prisma as never, quotes as never);

    await expect(service.create({ quoteId: 'quote-new' } as never, 'client-a')).rejects.toBeInstanceOf(ConflictException);

    expect(operations).toEqual(['client-lock', 'active-check']);
    expect(tx.$queryRaw.mock.calls[0][0].sql).toContain('FOR UPDATE');
    expect(tx.$queryRaw.mock.calls[0][0].values).toEqual(['client-a']);
    expect(tx.trips.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      client_id: 'client-a',
      OR: expect.arrayContaining([
        { status: { in: ['requested', 'accepted', 'ongoing'] } },
        { status: 'completed', trip_payment: { is: { status: 'pending' } } },
      ]),
    }) }));
    expect(quotes.consume).not.toHaveBeenCalled();
    expect(tx.trips.create).not.toHaveBeenCalled();
  });

  it('confirms a trip persisted before a transaction timeout instead of surfacing a false failure', async () => {
    const committed = { id: 'trip-after-timeout', client_id: 'client-a', quote_id: 'quote-a' };
    const prisma = {
      trips: { findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(committed) },
      $transaction: jest.fn().mockRejectedValue(new Error('transaction acknowledgement timed out')),
    };
    const service = new TripsService(prisma as never, {} as never);

    await expect(service.create({ quoteId: 'quote-a' } as never, 'client-a')).resolves.toBe(committed);
    expect(prisma.trips.findUnique).toHaveBeenNthCalledWith(2, { where: { quote_id: 'quote-a' } });
  });

  it('restores completed trips with a pending payment instead of relying on invoice absence', async () => {
    const prisma = { trips: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new TripsService(prisma as never, {} as never);
    await service.findActive('client-a');
    expect(prisma.trips.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        client_id: 'client-a',
        OR: expect.arrayContaining([{ status: 'completed', trip_payment: { is: { status: 'pending' } } }]),
      }),
    }));
  });

  it('restores the persisted quote polyline with active trips', async () => {
    const findMany = jest.fn().mockResolvedValue([{
      id: 'trip-active',
      trip_quotes: { pricing_snapshot: { route: { polyline: 'persisted-route' } } },
    }]);
    const service = new TripsService({ trips: { findMany } } as never, {} as never);

    const trips = await service.findActive('client-a');

    expect(trips[0]).toMatchObject({ id: 'trip-active', route_polyline: 'persisted-route' });
    expect(trips[0]).not.toHaveProperty('trip_quotes');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ trip_quotes: { select: { pricing_snapshot: true } } }),
    }));
  });

  it('returns the persisted payment fields with client history for truthful receipts', async () => {
    const payment = { status: 'confirmed', method: 'cash', amount: '950.00', confirmed_at: new Date('2026-01-01T00:00:00Z') };
    const prisma = { trips: { findMany: jest.fn().mockResolvedValue([{ id: 'trip-a', trip_payment: payment }]) } };
    const service = new TripsService(prisma as never, {} as never);

    const history = await service.getHistory('client-a');

    expect(prisma.trips.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        trip_payment: { select: { status: true, method: true, amount: true, confirmed_at: true } },
      }),
    }));
    expect(history[0].trip_payment).toEqual(payment);
  });

  it('returns the quoted route polyline for a client restoring a trip without exposing the pricing snapshot', async () => {
    const prisma = { trips: { findUnique: jest.fn().mockResolvedValue({
      id: 'trip-a',
      client_id: 'client-a',
      trip_quotes: { pricing_snapshot: { route: { polyline: 'encoded-route' }, pricing: { baseFare: 500 } } },
    }) } };
    const service = new TripsService(prisma as never, {} as never);

    const trip = await service.findOneForClient('trip-a', 'client-a');

    expect(trip).toMatchObject({ id: 'trip-a', route_polyline: 'encoded-route' });
    expect(trip).not.toHaveProperty('trip_quotes');
    expect(prisma.trips.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ trip_quotes: { select: { pricing_snapshot: true } } }),
    }));
  });

  it('applies one-based history pagination instead of returning the first page repeatedly', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new TripsService({ trips: { findMany } } as never, {} as never);

    await service.getHistory('client-a', 15, 'all', undefined, undefined, undefined, 3);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 15, skip: 30 }));
  });
});
