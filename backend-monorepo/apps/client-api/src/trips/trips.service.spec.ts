import { ForbiddenException } from '@nestjs/common';
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

  it('creates a trip from the owned quote and its persisted fare, ignoring client price fields', async () => {
    const quote = { id: 'quote-a', origin_address: 'A', origin_lat: 1, origin_lng: 2, dest_address: 'B', dest_lat: 3, dest_lng: 4, estimated_fare: '950.00', service_config_id: 3, category: 'ride', delivery_info: null };
    const tx = { trips: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'trip-a', estimated_fare: '950.00' }) } };
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
    const tx = { trips: { findUnique: jest.fn().mockResolvedValue(existing), create: jest.fn() } };
    const prisma = { $transaction: jest.fn(callback => callback(tx)), trips: { findUnique: jest.fn() } };
    const quotes = { consume: jest.fn() };
    const service = new TripsService(prisma as never, quotes as never);
    await expect(service.create({ quoteId: 'quote-a' } as never, 'client-a')).resolves.toBe(existing);
    expect(quotes.consume).not.toHaveBeenCalled();
    expect(tx.trips.create).not.toHaveBeenCalled();
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
});
