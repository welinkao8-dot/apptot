import axios from 'axios';
import { unlink } from 'fs/promises';
import { AdminApiService } from './admin-api.service';

jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('fs/promises', () => ({ ...jest.requireActual('fs/promises'), unlink: jest.fn().mockResolvedValue(undefined) }));

function withTransaction<T extends object>(prisma: T) {
  if (!('$queryRawUnsafe' in prisma)) Object.assign(prisma, { $queryRawUnsafe: jest.fn().mockResolvedValue([]) });
  return Object.assign(prisma, {
    $transaction: jest.fn((operation: (transaction: T) => unknown) => operation(prisma)),
  });
}

describe('AdminApiService', () => {
  beforeEach(() => jest.mocked(unlink).mockClear());

  it('cleans an unreferenced app-managed image after a service image is replaced', async () => {
    const imageUrl = 'http://localhost:3000/uploads/services/11111111-1111-4111-8111-111111111111.webp';
    const prisma = withTransaction({
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 7, image_url: imageUrl, vehicle_category: 'car', routing_mode: 'car' }]),
      service_configs: {
        update: jest.fn().mockResolvedValue({ id: 7, image_url: 'http://localhost:3000/uploads/services/new.png' }),
        count: jest.fn().mockResolvedValue(0),
      },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = new AdminApiService(prisma as never, { sendToAdmins: jest.fn() } as never, {} as never);

    await service.updateServiceConfig(7, { image_url: 'http://localhost:3000/uploads/services/new.png' });

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT "id", "image_url", "vehicle_category", "routing_mode" FROM "service_configs" WHERE "id" = $1 FOR UPDATE',
      7,
    );
    expect(prisma.$queryRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(prisma.service_configs.update.mock.invocationCallOrder[0]);
    expect(unlink).toHaveBeenCalledWith(expect.stringMatching(/uploads[\\/]services[\\/]11111111-1111-4111-8111-111111111111\.webp$/));
  });

  it('cleans an unreferenced app-managed image after a service is deleted', async () => {
    const imageUrl = 'http://localhost:3000/uploads/services/22222222-2222-4222-8222-222222222222.jpg';
    const prisma = withTransaction({
      $queryRaw: jest.fn().mockResolvedValue([{ id: 7, image_url: imageUrl }]),
      trips: { count: jest.fn().mockResolvedValue(0) },
      trip_quotes: { count: jest.fn().mockResolvedValue(0) },
      service_configs: { delete: jest.fn().mockResolvedValue({ id: 7 }), count: jest.fn().mockResolvedValue(0) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = new AdminApiService(prisma as never, { sendToAdmins: jest.fn() } as never, {} as never);

    await service.deleteServiceConfig(7, 'admin-profile-id');

    expect(unlink).toHaveBeenCalledWith(expect.stringMatching(/uploads[\\/]services[\\/]22222222-2222-4222-8222-222222222222\.jpg$/));
  });

  it('retains a service image still referenced by another service config', async () => {
    const imageUrl = 'http://localhost:3000/uploads/services/33333333-3333-4333-8333-333333333333.png';
    const prisma = withTransaction({
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 7, image_url: imageUrl, vehicle_category: 'car', routing_mode: 'car' }]),
      service_configs: { update: jest.fn().mockResolvedValue({ id: 7 }), count: jest.fn().mockResolvedValue(1) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = new AdminApiService(prisma as never, { sendToAdmins: jest.fn() } as never, {} as never);

    await service.updateServiceConfig(7, { image_url: 'https://cdn.example/new.png' });

    expect(prisma.service_configs.count).toHaveBeenCalledWith({ where: { image_url: imageUrl } });
    expect(unlink).not.toHaveBeenCalled();
  });

  it('preserves an external image URL when replacing a service image', async () => {
    const imageUrl = 'https://cdn.example.com/services/image.png';
    const prisma = withTransaction({
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 7, image_url: imageUrl, vehicle_category: 'car', routing_mode: 'car' }]),
      service_configs: { update: jest.fn().mockResolvedValue({ id: 7 }), count: jest.fn() },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = new AdminApiService(prisma as never, { sendToAdmins: jest.fn() } as never, {} as never);

    await service.updateServiceConfig(7, { image_url: 'https://cdn.example.com/services/new.png' });

    expect(prisma.service_configs.count).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });

  it('does not clean a URL containing a traversal path', async () => {
    const imageUrl = 'http://localhost:3000/uploads/services/../outside.jpg';
    const prisma = withTransaction({
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 7, image_url: imageUrl, vehicle_category: 'car', routing_mode: 'car' }]),
      service_configs: { update: jest.fn().mockResolvedValue({ id: 7 }), count: jest.fn() },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = new AdminApiService(prisma as never, { sendToAdmins: jest.fn() } as never, {} as never);

    await service.updateServiceConfig(7, { image_url: 'https://cdn.example/new.png' });

    expect(prisma.service_configs.count).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });

  it('does not clean a service image when the database update fails', async () => {
    const imageUrl = 'http://localhost:3000/uploads/services/44444444-4444-4444-8444-444444444444.jpg';
    const prisma = withTransaction({
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 7, image_url: imageUrl, vehicle_category: 'car', routing_mode: 'car' }]),
      service_configs: { update: jest.fn().mockRejectedValue(new Error('database unavailable')), count: jest.fn() },
      audit_logs: { create: jest.fn() },
    });
    const service = new AdminApiService(prisma as never, { sendToAdmins: jest.fn() } as never, {} as never);

    await expect(service.updateServiceConfig(7, { image_url: 'http://localhost:3000/uploads/services/new.png' })).rejects.toThrow('database unavailable');

    expect(unlink).not.toHaveBeenCalled();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });

  it('audits service deletion with the authenticated admin in the same transaction', async () => {
    const prisma = withTransaction({
      $queryRaw: jest.fn().mockResolvedValue([{ id: 7 }]),
      trips: { count: jest.fn().mockResolvedValue(0) },
      trip_quotes: { count: jest.fn().mockResolvedValue(0) },
      service_configs: { delete: jest.fn().mockResolvedValue({ id: 7 }) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = new AdminApiService(prisma as never, { sendToAdmins: jest.fn() } as never, {} as never);

    await expect(service.deleteServiceConfig(7, 'admin-profile-id')).resolves.toEqual({ success: true, id: 7 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('FOR UPDATE')]), 7,
    );
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.trips.count.mock.invocationCallOrder[0]);
    expect(prisma.audit_logs.create).toHaveBeenCalledWith({ data: {
      admin_id: 'admin-profile-id', action: 'DELETE_SERVICE', target: 'service_config', target_id: '7', details: {},
    } });
  });

  it.each(['trip', 'quote'])('blocks service deletion while an unexpired %s depends on it', async (dependency) => {
    const prisma = withTransaction({
      $queryRaw: jest.fn().mockResolvedValue([{ id: 7 }]),
      trips: { count: jest.fn().mockResolvedValue(dependency === 'trip' ? 1 : 0) },
      trip_quotes: { count: jest.fn().mockResolvedValue(dependency === 'quote' ? 1 : 0) },
      service_configs: { delete: jest.fn() },
      audit_logs: { create: jest.fn() },
    });
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await expect(service.deleteServiceConfig(7, 'admin-profile-id')).rejects.toThrow();
    expect(prisma.service_configs.delete).not.toHaveBeenCalled();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });


  it('does not count dependencies or delete when the service row is missing under lock', async () => {
    const prisma = withTransaction({
      $queryRaw: jest.fn().mockResolvedValue([]),
      trips: { count: jest.fn() },
      trip_quotes: { count: jest.fn() },
      service_configs: { delete: jest.fn() },
      audit_logs: { create: jest.fn() },
    });
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await expect(service.deleteServiceConfig(7, 'admin-profile-id')).rejects.toThrow('Serviço não encontrado');
    expect(prisma.trips.count).not.toHaveBeenCalled();
    expect(prisma.trip_quotes.count).not.toHaveBeenCalled();
    expect(prisma.service_configs.delete).not.toHaveBeenCalled();
  });

  it('returns only a driver’s verification documents for the protected review screen', async () => {
    const documents = { doc_bi_frente: 'data:image/jpeg;base64,front', doc_bi_verso: 'data:image/png;base64,back', doc_carta_conducao: 'data:image/jpeg;base64,license' };
    const findUnique = jest.fn().mockResolvedValue({ id: 'driver-a', ...documents });
    const service = new AdminApiService({ drivers: { findUnique } } as never, {} as never, {} as never);

    await expect(service.getDriverDocuments('driver-a')).resolves.toEqual({ id: 'driver-a', ...documents });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'driver-a' },
      select: { id: true, doc_bi_frente: true, doc_bi_verso: true, doc_carta_conducao: true },
    });
  });

  it('paginates audit entries, filters by persisted fields, and projects only safe columns', async () => {
    const findMany = jest.fn().mockResolvedValue([{
      id: 'audit-a', action: 'UPDATE_STATUS_SUSPENDED', target: 'driver', target_id: 'driver-a',
      created_at: new Date('2026-10-15T10:00:00Z'), details: { reason: 'Review complete', password: 'secret', doc_bi_frente: 'base64', current_lat: -8.9 },
      profiles: { full_name: 'Admin A' },
    }]);
    const count = jest.fn().mockResolvedValue(23);
    const service = new AdminApiService({ audit_logs: { findMany, count } } as never, {} as never, {} as never);

    await expect(service.getAuditLogs(2, 10, { action: 'UPDATE_STATUS_SUSPENDED', target: 'driver', search: 'admin' }))
      .resolves.toMatchObject({
        items: [{ id: 'audit-a', action: 'UPDATE_STATUS_SUSPENDED', target: 'driver', target_id: 'driver-a', profiles: { full_name: 'Admin A' }, details: { reason: 'Review complete' } }],
        total: 23, page: 2, pageSize: 10,
      });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        action: 'UPDATE_STATUS_SUSPENDED', target: 'driver',
        OR: expect.arrayContaining([
          { action: { contains: 'admin', mode: 'insensitive' } },
          { target_id: { contains: 'admin', mode: 'insensitive' } },
          { profiles: { is: { full_name: { contains: 'admin', mode: 'insensitive' } } } },
        ]),
      }),
      skip: 10, take: 10, select: expect.objectContaining({ id: true, action: true, details: true }),
    }));
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('admin_id');
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('include');
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ created_at: 'desc' }, { id: 'desc' }]);
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ where: findMany.mock.calls[0][0].where }));
  });

  it('classifies a driver, forces them offline, and audits the admin in one transaction', async () => {
    const prisma = withTransaction({
      trips: { count: jest.fn().mockResolvedValue(0) },
      drivers: { update: jest.fn().mockResolvedValue({ id: 'driver-a', vehicle_category: 'moto', is_online: false }) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await expect(service.updateDriverVehicleCategory('driver-a', 'moto', 'admin-a'))
      .resolves.toMatchObject({ vehicle_category: 'moto', is_online: false });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT id FROM drivers WHERE id = $1::uuid FOR UPDATE', 'driver-a');
    expect(prisma.drivers.update).toHaveBeenCalledWith({ where: { id: 'driver-a' }, data: { vehicle_category: 'moto', is_online: false } });
    expect(prisma.audit_logs.create).toHaveBeenCalledWith({ data: expect.objectContaining({ admin_id: 'admin-a', action: 'UPDATE_DRIVER_VEHICLE_CATEGORY' }) });
  });

  it('locks the driver row before checking active trips for a vehicle change', async () => {
    const operations: string[] = [];
    const prisma = withTransaction({
      $queryRawUnsafe: jest.fn(async () => { operations.push('lock'); return []; }),
      trips: { count: jest.fn(async () => { operations.push('count'); return 0; }) },
      drivers: { update: jest.fn().mockResolvedValue({ id: 'driver-a' }) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await service.updateDriverVehicleCategory('driver-a', 'car');

    expect(operations).toEqual(['lock', 'count']);
  });

  it('prevents vehicle reclassification during an active trip', async () => {
    const prisma = withTransaction({
      trips: { count: jest.fn().mockResolvedValue(1) },
      drivers: { update: jest.fn() },
      audit_logs: { create: jest.fn() },
    });
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await expect(service.updateDriverVehicleCategory('driver-a', 'car', 'admin-a')).rejects.toThrow('corrida ativa');
    expect(prisma.drivers.update).not.toHaveBeenCalled();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });

  it('returns only persisted platform statistics instead of demo configuration values', async () => {
    const prisma = {
      drivers: { count: jest.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(8) },
      profiles: { count: jest.fn().mockResolvedValue(34) },
      trips: { count: jest.fn().mockResolvedValue(56) },
    };
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await expect(service.getAppSettings()).resolves.toEqual({
      stats: { totalDrivers: 12, activeDrivers: 8, totalClients: 34, totalTrips: 56 },
    });
  });

  it('includes persisted payment status with invoices so issued receipts are not reported as collected cash', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AdminApiService({ invoices: {
      findMany, count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    } } as never, {} as never, {} as never);

    await service.getAllInvoices();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        trips: expect.objectContaining({
          select: expect.objectContaining({
            trip_payment: { select: { method: true, amount: true, status: true, confirmed_at: true } },
          }),
        }),
      }),
    }));
  });

  it('selects the actual persisted GPS fix, accuracy and timestamp for online operations', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AdminApiService({ drivers: { findMany } } as never, {} as never, {} as never);

    await service.getOnlineDriversLocations();

    expect(findMany).toHaveBeenCalledWith({
      where: { is_online: true },
      select: {
        id: true,
        full_name: true,
        phone: true,
        status: true,
        current_lat: true,
        current_lng: true,
        current_accuracy: true,
        last_location_update: true,
        rating: true,
      },
    });
  });

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

  it('records the authenticated admin as the pricing audit actor', async () => {
    const create = jest.fn().mockResolvedValue({ id: 9, name: 'Carro' });
    const auditCreate = jest.fn().mockResolvedValue({});
    const service = new AdminApiService(
      { service_configs: { create }, audit_logs: { create: auditCreate } } as never,
      { sendToAdmins: jest.fn() } as never,
      {} as never,
    );

    await service.createServiceConfig({ name: 'Carro', routing_mode: 'car' }, 'admin-profile-id');

    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ admin_id: 'admin-profile-id' }) });
  });

  it('records the authenticated admin when pricing is updated', async () => {
    const update = jest.fn().mockResolvedValue({ id: 9, base_fare: 600 });
    const auditCreate = jest.fn().mockResolvedValue({});
    const service = new AdminApiService(
      withTransaction({
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 9, image_url: null, vehicle_category: 'car', routing_mode: 'car' }]),
        service_configs: { update }, audit_logs: { create: auditCreate },
      }) as never,
      { sendToAdmins: jest.fn() } as never,
      {} as never,
    );

    await service.updateServiceConfig(9, { base_fare: 600 }, 'admin-profile-id');

    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ admin_id: 'admin-profile-id' }) });
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

  it('rejects a motorbike service configured with car routing before create', async () => {
    const create = jest.fn();
    const service = new AdminApiService({ service_configs: { create } } as never, {} as never, {} as never);

    await expect(service.createServiceConfig({ vehicle_category: 'moto', routing_mode: 'car' }))
      .rejects.toThrow('incompatível');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a partial update that makes the stored vehicle and routing mode incompatible', async () => {
    const queryRawUnsafe = jest.fn().mockResolvedValue([{ id: 7, image_url: null, vehicle_category: 'Moto', routing_mode: 'scooter' }]);
    const update = jest.fn();
    const prisma = withTransaction({ $queryRawUnsafe: queryRawUnsafe, service_configs: { update } });
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await expect(service.updateServiceConfig(7, { routing_mode: 'car' })).rejects.toThrow('incompatível');
    expect(update).not.toHaveBeenCalled();
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

  it('returns one bounded admin trip page with its total and payment settlement state', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(21);
    const service = new AdminApiService({ trips: { findMany, count } } as never, {} as never, {} as never);
    await expect(service.getAllTrips(2, 10)).resolves.toEqual({ items: [], total: 21, page: 2, pageSize: 10 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      include: expect.objectContaining({ trip_payment: true, invoices: true }),
    }));
    expect(count).toHaveBeenCalledWith({ where: {} });
  });

  it('applies the active status and search to both the trip page and its total', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = new AdminApiService({ trips: { findMany, count } } as never, {} as never, {} as never);

    await service.getAllTrips(1, 20, 'live', 'ana');

    const where = {
      status: { in: ['requested', 'accepted', 'arrived', 'ongoing'] },
      OR: [
        { id: { contains: 'ana', mode: 'insensitive' } },
        { profiles_trips_client_idToprofiles: { is: { full_name: { contains: 'ana', mode: 'insensitive' } } } },
        { profiles_trips_driver_idToprofiles: { is: { full_name: { contains: 'ana', mode: 'insensitive' } } } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('counts only confirmed payments in the admin client paid-trip metric', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AdminApiService({ profiles: { findMany, count: jest.fn().mockResolvedValue(0) } } as never, {} as never, {} as never);
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

  it('returns a bounded client page and applies the same database search to items and total', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(23);
    const service = new AdminApiService({ profiles: { findMany, count } } as never, {} as never, {} as never);
    await expect(service.getAllClients(2, 10, 'ana')).resolves.toEqual({ items: [], total: 23, page: 2, pageSize: 10 });
    const where = { role: 'client', OR: [
      { full_name: { contains: 'ana', mode: 'insensitive' } },
      { phone: { contains: 'ana', mode: 'insensitive' } },
    ] };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where,
      skip: 10,
      take: 10,
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
    }));
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('returns a bounded driver page and applies status and search to rows and total', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'driver-a', status: 'pending', password_hash: 'secret' }]);
    const count = jest.fn().mockResolvedValue(12);
    const service = new AdminApiService({ drivers: { findMany, count } } as never, {} as never, {} as never);
    await expect(service.getAllDrivers(2, 10, 'pending', 'ana')).resolves.toEqual({
      items: [{ id: 'driver-a', status: 'pending' }], total: 12, page: 2, pageSize: 10,
    });
    const where = {
      status: 'pending',
      OR: [
        { full_name: { contains: 'ana', mode: 'insensitive' } },
        { phone: { contains: 'ana', mode: 'insensitive' } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where, skip: 10, take: 10, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    }));
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('returns only the requested client trip page with the confirmed spend summary', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'trip-a', client_id: 'client-a' }]);
    const count = jest.fn().mockResolvedValue(23);
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: '1250.50' } });
    const service = new AdminApiService({ trips: { findMany, count }, trip_payments: { aggregate } } as never, {} as never, {} as never);
    await expect(service.getClientTrips('client-a', 2, 10)).resolves.toEqual({
      items: [{ id: 'trip-a', client_id: 'client-a' }], total: 23, page: 2, pageSize: 10,
      summary: { confirmedSpend: 1250.5 },
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { client_id: 'client-a' }, skip: 10, take: 10, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      include: expect.objectContaining({ trip_payment: true, invoices: true }),
    }));
    expect(count).toHaveBeenCalledWith({ where: { client_id: 'client-a' } });
    expect(aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'confirmed', trips: { is: { client_id: 'client-a' } } } }));
  });

  it('returns only the requested driver trip page with the completed earnings summary', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'trip-a', driver_id: 'driver-a' }]);
    const count = jest.fn().mockResolvedValue(23);
    const aggregate = jest.fn().mockResolvedValue({ _sum: { final_fare: '850.25' } });
    const service = new AdminApiService({ trips: { findMany, count, aggregate } } as never, {} as never, {} as never);
    await expect(service.getDriverTrips('driver-a', 2, 10)).resolves.toEqual({
      items: [{ id: 'trip-a', driver_id: 'driver-a' }], total: 23, page: 2, pageSize: 10,
      summary: { completedEarnings: 850.25 },
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { driver_id: 'driver-a' }, skip: 10, take: 10, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    }));
    expect(count).toHaveBeenCalledWith({ where: { driver_id: 'driver-a' } });
    expect(aggregate).toHaveBeenCalledWith({ where: { driver_id: 'driver-a', status: 'completed' }, _sum: { final_fare: true } });
  });

  it('returns a filtered invoice page while calculating dashboard totals across all invoices', async () => {
    const findMany = jest.fn().mockResolvedValueOnce([{ id: 'invoice-a', amount: '25.00' }]).mockResolvedValueOnce([{ invoice_type: 'ride' }, { invoice_type: 'delivery' }]);
    const count = jest.fn().mockResolvedValueOnce(17).mockResolvedValueOnce(3);
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: '4500.00' } });
    const service = new AdminApiService({ invoices: { findMany, count, aggregate } } as never, {} as never, {} as never);
    await expect(service.getAllInvoices(2, 10, 'ride', 'ana')).resolves.toMatchObject({
      items: [{ id: 'invoice-a', amount: '25.00' }], total: 17, page: 2, pageSize: 10,
      summary: { receiptTotal: 4500, invoiceTypes: ['ride', 'delivery'] },
    });
    const where = { invoice_type: 'ride', OR: [
      { id: { contains: 'ana', mode: 'insensitive' } },
      { profiles: { is: { full_name: { contains: 'ana', mode: 'insensitive' } } } },
    ] };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where, skip: 10, take: 10, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    }));
    expect(count).toHaveBeenCalledWith({ where });
    expect(count).toHaveBeenCalledWith({ where: { created_at: { gte: expect.any(Date) } } });
    expect(aggregate).toHaveBeenCalledWith({ _sum: { amount: true } });
    expect(findMany).toHaveBeenNthCalledWith(2, { distinct: ['invoice_type'], select: { invoice_type: true } });
  });

  it('returns a filtered payment page and full-ledger financial summaries', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'payment-a', status: 'pending' }]);
    const count = jest.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(9).mockResolvedValueOnce(13);
    const aggregate = jest.fn()
      .mockResolvedValueOnce({ _sum: { amount: '1200' } })
      .mockResolvedValueOnce({ _sum: { amount: '300' } });
    const service = new AdminApiService({ trip_payments: { findMany, count, aggregate } } as never, {} as never, {} as never);
    await expect(service.getAllPayments(3, 5, 'pending', 'ana')).resolves.toMatchObject({
      items: [{ id: 'payment-a', status: 'pending' }], total: 7, page: 3, pageSize: 5,
      summary: { pendingCount: 9, confirmedCount: 13, confirmedCashTotal: 1200, cashPendingTotal: 300 },
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'pending', OR: expect.any(Array) }),
      skip: 10, take: 5, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    }));
    expect(count).toHaveBeenCalledWith({ where: { status: 'pending', OR: expect.any(Array) } });
    expect(count).toHaveBeenCalledWith({ where: { status: 'pending' } });
    expect(count).toHaveBeenCalledWith({ where: { status: 'confirmed' } });
    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it('uses the configured internal service token when notifying the driver API', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();
    const prisma = withTransaction({
      drivers: { update: jest.fn().mockResolvedValue({}) },
      profiles: { update: jest.fn().mockResolvedValue({}) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    });
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

  it('records the authenticated admin as actor for driver status changes', async () => {
    const auditCreate = jest.fn().mockResolvedValue({});
    const prisma = withTransaction({
      drivers: { update: jest.fn().mockResolvedValue({}) },
      profiles: { update: jest.fn().mockResolvedValue({}) },
      audit_logs: { create: auditCreate },
    });
    const service = new AdminApiService(prisma as never, { sendToAdmins: jest.fn() } as never, {
      get: jest.fn(key => key === 'INTERNAL_SERVICE_TOKEN' ? 'service-token' : 'http://driver-api:3004'),
    } as never);
    jest.mocked(axios.post).mockResolvedValue({ data: { success: true } });

    await service.updateDriverStatus('driver-a', 'suspended', 'admin-profile-id', 'document review');

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT id FROM drivers WHERE id = $1::uuid FOR UPDATE', 'driver-a');
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      admin_id: 'admin-profile-id', action: 'UPDATE_STATUS_SUSPENDED', target: 'driver', target_id: 'driver-a',
      details: { reason: 'document review' },
    }) });
  });

  it('records the authenticated admin as actor for client status changes', async () => {
    const auditCreate = jest.fn().mockResolvedValue({});
    const prisma = withTransaction({
      profiles: { update: jest.fn().mockResolvedValue({}) },
      audit_logs: { create: auditCreate },
    });
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await service.updateClientStatus('client-a', 'suspended', 'admin-profile-id', 'policy review');

    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      admin_id: 'admin-profile-id', action: 'UPDATE_CLIENT_STATUS_SUSPENDED', target: 'client', target_id: 'client-a',
      details: { reason: 'policy review' },
    }) });
  });

  it('records the authenticated admin who approved a driver', async () => {
    const auditCreate = jest.fn().mockResolvedValue({});
    const prisma = withTransaction({
      drivers: { update: jest.fn().mockResolvedValue({}) },
      profiles: { update: jest.fn().mockResolvedValue({ id: 'driver-a', status: 'active' }) },
      audit_logs: { create: auditCreate },
    });
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await service.approveDriver('driver-a', 'admin-profile-id');

    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      admin_id: 'admin-profile-id', action: 'APPROVE_DRIVER', target: 'driver', target_id: 'driver-a',
    }) });
  });

  it('rolls back driver approval when the matching profile update fails', async () => {
    let driverStatus = 'pending';
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      drivers: { update: jest.fn(async ({ data }: any) => { driverStatus = data.status; }) },
      profiles: { update: jest.fn(async () => { throw new Error('profile unavailable'); }) },
      audit_logs: { create: jest.fn() },
    };
    const transaction = jest.fn(async (operation: (transaction: typeof tx) => unknown) => {
      const previousStatus = driverStatus;
      try {
        return await operation(tx);
      } catch (error) {
        driverStatus = previousStatus;
        throw error;
      }
    });
    const prisma = {
      $transaction: transaction,
      drivers: tx.drivers,
      profiles: tx.profiles,
      audit_logs: tx.audit_logs,
    };
    const service = new AdminApiService(prisma as never, {} as never, {} as never);

    await expect(service.approveDriver('driver-a', 'admin-profile-id')).rejects.toThrow('profile unavailable');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(driverStatus).toBe('pending');
  });

  it('rolls back a driver status update and rejects when the matching profile update fails', async () => {
    let driverStatus = 'active';
    const auditCreate = jest.fn();
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      drivers: { update: jest.fn(async ({ data }: any) => { driverStatus = data.status; }) },
      profiles: { update: jest.fn(async () => { throw new Error('profile unavailable'); }) },
      audit_logs: { create: auditCreate },
    };
    const transaction = jest.fn(async (operation: (transaction: typeof tx) => unknown) => {
      const previousStatus = driverStatus;
      try {
        return await operation(tx);
      } catch (error) {
        driverStatus = previousStatus;
        throw error;
      }
    });
    const sendToAdmins = jest.fn();
    const prisma = {
      $transaction: transaction,
      drivers: tx.drivers,
      profiles: tx.profiles,
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new AdminApiService(prisma as never, { sendToAdmins } as never, {
      get: jest.fn(key => key === 'INTERNAL_SERVICE_TOKEN' ? 'service-token' : 'http://driver-api:3004'),
    } as never);

    await expect(service.updateDriverStatus('driver-a', 'suspended', 'admin-profile-id'))
      .rejects.toThrow('profile unavailable');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(driverStatus).toBe('active');
    expect(auditCreate).not.toHaveBeenCalled();
    expect(sendToAdmins).not.toHaveBeenCalled();
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
