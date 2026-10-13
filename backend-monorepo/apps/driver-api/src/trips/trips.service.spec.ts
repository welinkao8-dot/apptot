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
    const prisma = {
      trips: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new TripsService(prisma as never);

    await expect(service.accept('trip-a', 'driver-b')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.trips.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'trip-a', driver_id: null, status: { in: ['requested'] } },
    }));
  });

  it('cancels only a trip owned by the actor while it is before the ride starts', async () => {
    const prisma = {
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-a', client_id: 'client-a', driver_id: null, status: 'cancelled' }),
      },
    };
    const service = new TripsService(prisma as never);

    await service.cancel('trip-a', { role: 'client', id: 'client-a' });
    expect(prisma.trips.updateMany).toHaveBeenCalledWith({
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
    const prisma = { trips: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
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
});
