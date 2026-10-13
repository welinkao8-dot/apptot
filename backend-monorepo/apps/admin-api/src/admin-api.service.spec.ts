import axios from 'axios';
import { AdminApiService } from './admin-api.service';

jest.mock('axios', () => ({ post: jest.fn() }));

describe('AdminApiService', () => {
  it('persists the explicit route mode for a newly configured service', async () => {
    const create = jest.fn().mockResolvedValue({ id: 7, name: 'Moto', routing_mode: 'scooter' });
    const service = new AdminApiService(
      { service_configs: { create }, audit_logs: { create: jest.fn() } } as never,
      { sendToAdmins: jest.fn() } as never,
      {} as never,
    );

    await service.createServiceConfig({ name: 'Moto', routing_mode: 'scooter' });

    expect(create).toHaveBeenCalledWith({ data: { name: 'Moto', routing_mode: 'scooter' } });
  });

  it('rejects an unsupported route mode before changing a service', async () => {
    const create = jest.fn().mockResolvedValue({ id: 7 });
    const service = new AdminApiService(
      { service_configs: { create }, audit_logs: { create: jest.fn() } } as never,
      { sendToAdmins: jest.fn() } as never,
      {} as never,
    );

    await expect(service.createServiceConfig({ name: 'Unknown', routing_mode: 'spaceship' }))
      .rejects.toThrow('routing_mode');

    expect(create).not.toHaveBeenCalled();
  });

  it('reports only persisted confirmed cash payments as realized revenue', async () => {
    const aggregate = jest.fn()
      .mockResolvedValueOnce({ _sum: { amount: '100' } })
      .mockResolvedValueOnce({ _sum: { amount: '20' } })
      .mockResolvedValueOnce({ _sum: { amount: '45' } });
    const prisma = {
      trips: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn() },
      drivers: { count: jest.fn().mockResolvedValue(0) },
      profiles: { count: jest.fn().mockResolvedValue(0) },
      trip_payments: { aggregate },
    };
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    const result = await service.getDashboardStats();
    expect(result.totalRevenue).toBe(100);
    expect(result.todayRevenue).toBe(20);
    expect(result.monthlyRevenue).toBe(45);
    expect(prisma.trips.aggregate).not.toHaveBeenCalled();
    expect(aggregate.mock.calls.every(([query]) => query.where.status === 'confirmed')).toBe(true);
    expect(aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ confirmed_at: { gte: expect.any(Date) } }) }));
  });

  it('loads payment settlement state for admin trip history', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AdminApiService({ trips: { findMany } } as never, {} as never, {} as never);
    await service.getAllTrips();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({ trip_payment: true, invoices: true }) }));
  });

  it('counts only confirmed payments in the admin client paid-trip metric', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AdminApiService({ profiles: { findMany } } as never, {} as never, {} as never);
    await service.getAllClients();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        _count: expect.objectContaining({
          select: expect.objectContaining({
            trips_trips_client_idToprofiles: { where: { trip_payment: { is: { status: 'confirmed' } } } },
          }),
        }),
      }),
    }));
  });

  it('uses the configured internal service token when notifying the driver API', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();
    const prisma = {
      drivers: { update: jest.fn().mockResolvedValue({}) },
      profiles: { update: jest.fn().mockResolvedValue({}) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    };
    const adminGateway = { sendToAdmins: jest.fn() };
    jest.mocked(axios.post).mockResolvedValue({ data: { success: true } });
    const config = { get: jest.fn((key: string) => key === 'DRIVER_API_URL' ? 'http://driver-api:3004' : 'service-token') };
    const service = new AdminApiService(prisma as never, adminGateway as never, config as never);

    await service.updateDriverStatus('driver-a', 'active');

    expect(axios.post).toHaveBeenCalledWith(
      'http://driver-api:3004/notify-driver-status',
      { driverId: 'driver-a', status: 'active' },
      { headers: { 'x-internal-service-token': 'service-token' } },
    );
    log.mockRestore();
  });

  it('rejects a status change when the internal service token is missing', async () => {
    const prisma = {
      drivers: { update: jest.fn().mockResolvedValue({}) },
      profiles: { update: jest.fn().mockResolvedValue({}) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new AdminApiService(
      prisma as never,
      { sendToAdmins: jest.fn() } as never,
      { get: jest.fn().mockReturnValue('') } as never,
    );

    await expect(service.updateDriverStatus('driver-a', 'active'))
      .rejects.toThrow('INTERNAL_SERVICE_TOKEN');

    expect(prisma.drivers.update).not.toHaveBeenCalled();
  });

  it('fails before mutation when the production driver service URL is missing', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const prisma = {
      drivers: { update: jest.fn() },
      profiles: { update: jest.fn() },
      audit_logs: { create: jest.fn() },
    };
    const service = new AdminApiService(prisma as never, { sendToAdmins: jest.fn() } as never, {
      get: jest.fn(key => key === 'INTERNAL_SERVICE_TOKEN' ? 'service-token' : undefined),
    } as never);
    try {
      await expect(service.updateDriverStatus('driver-a', 'active')).rejects.toThrow('DRIVER_API_URL');
      expect(prisma.drivers.update).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
