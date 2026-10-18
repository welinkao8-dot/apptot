import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '@app/database';
import { AdminGateway } from './../src/admin-api.gateway';
import { AdminApiModule } from './../src/admin-api.module';
import { QuotePreviewService } from './../src/quote-preview.service';

describe('AdminApiController (e2e)', () => {
  const adminDriverRouteId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const adminClientRouteId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'task-3-e2e-secret';
    process.env.API_RATE_LIMIT_LIMIT = '10';
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AdminApiModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        drivers: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'driver-a', full_name: 'Driver A', phone: '900000000', status: 'active',
              password: 'driver-password', doc_bi_frente: 'front-document',
              doc_bi_verso: 'back-document', doc_carta_conducao: 'licence-document',
            },
          ]),
          count: jest.fn().mockResolvedValue(1),
          findUnique: jest.fn(async ({ select }: { select?: Record<string, boolean> } = {}) => {
            const driver = {
              id: 'driver-a', full_name: 'Driver A', phone: '900000000',
              password: 'driver-password', doc_bi_frente: 'front-document',
              doc_bi_verso: 'back-document', doc_carta_conducao: 'licence-document',
            };
            return select ? Object.fromEntries(Object.keys(select).map(key => [key, driver[key as keyof typeof driver]])) : driver;
          }),
        },
        driver_documents: {
          findMany: jest.fn().mockResolvedValue([
            { document_type: 'bi_frente', content: Buffer.from([0xff, 0xd8, 0xff]), mime_type: 'image/jpeg' },
            { document_type: 'bi_verso', content: Buffer.from([0xff, 0xd8, 0xff]), mime_type: 'image/jpeg' },
            { document_type: 'carta', content: Buffer.from([0xff, 0xd8, 0xff]), mime_type: 'image/jpeg' },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        profiles: {
          count: jest.fn().mockResolvedValue(1),
          update: jest.fn().mockResolvedValue({ id: 'client-a', status: 'suspended' }),
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'client-a', full_name: 'Client A', phone: '911111111', role: 'client',
              password_hash: 'client-hash', _count: { trips_trips_client_idToprofiles: 2 },
            },
          ]),
        },
        invoices: {
          findMany: jest.fn(async (query: { distinct?: string[] } = {}) => query.distinct
            ? [{ invoice_type: 'ride' }, { invoice_type: 'delivery' }]
            : [{ id: 'invoice-a', amount: '950.00', invoice_type: 'ride', created_at: new Date(), profiles: { full_name: 'Client A' }, trips: { id: 'trip-a' } }]),
          count: jest.fn().mockResolvedValue(1),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: '950.00' } }),
        },
        trips: {
          findMany: jest.fn().mockResolvedValue([{ id: 'trip-a', status: 'ongoing' }]),
          count: jest.fn().mockResolvedValue(41),
          aggregate: jest.fn().mockResolvedValue({ _sum: { final_fare: '900' } }),
        },
        trip_payments: {
          findMany: jest.fn().mockResolvedValue([{ id: 'payment-a', method: 'cash', amount: '950.00', status: 'pending', trips: { id: 'trip-a' }, profiles: null }]),
          count: jest.fn().mockResolvedValue(1),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: '950.00' } }),
        },
        audit_logs: {
          findMany: jest.fn().mockResolvedValue([{ id: 'audit-a', action: 'UPDATE_STATUS_ACTIVE', target: 'driver', target_id: 'driver-a', created_at: new Date(), details: {}, profiles: { full_name: 'Admin A' } }]),
          count: jest.fn().mockResolvedValue(1),
        },
        $transaction: jest.fn((callback) => callback({
          $queryRawUnsafe: jest.fn().mockResolvedValue([]),
          drivers: { update: jest.fn().mockResolvedValue({ id: 'driver-a', status: 'rejected' }) },
          driver_documents: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          profiles: { update: jest.fn().mockResolvedValue({ id: 'client-a', status: 'suspended' }) },
          audit_logs: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
        })),
      })
      .overrideProvider(AdminGateway)
      .useValue({ sendToAdmins: jest.fn() })
      .overrideProvider(QuotePreviewService)
      .useValue({ preview: jest.fn().mockResolvedValue({ serviceConfigId: 7, serviceName: 'Carro', distanceMeters: 10000, durationSeconds: 1200, currentFare: '2500.00', proposedFare: '3000.00' }) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 429 after the configured request budget is exhausted', async () => {
    let response;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await request(app.getHttpServer()).get('/admin/stats');
    }
    expect(response?.status).toBe(429);
  });

  it('reports database readiness on the unauthenticated health route', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('returns the first audit page with omitted or blank optional filters', async () => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    const omitted = await request(app.getHttpServer())
      .get('/admin/logs?page=1&limit=15')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(omitted.body).toMatchObject({ items: [{ id: 'audit-a' }], total: 1, page: 1, pageSize: 15 });

    await request(app.getHttpServer())
      .get('/admin/logs?page=1&limit=15&action=&target=&search=')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('rejects an unauthenticated management-list request', () => {
    return request(app.getHttpServer()).get('/admin/drivers').expect(401);
  });

  it('protects the server-side quote preview and validates its route and proposed fare', async () => {
    const path = '/admin/services/7/quote-preview';
    const body = {
      originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3,
      proposed: { base_fare: 600, price_per_km: 120, price_per_min: 60, min_fare: 800 },
    };
    await request(app.getHttpServer()).post(path).send(body).expect(401);
    const clientToken = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${clientToken}`).send(body).expect(403);
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${adminToken}`).send(body)
      .expect(200).expect({ serviceConfigId: 7, serviceName: 'Carro', distanceMeters: 10000, durationSeconds: 1200, currentFare: '2500.00', proposedFare: '3000.00' });
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${adminToken}`)
      .send({ ...body, originLat: 0 }).expect(400);
  });

  it('rejects malformed resource ids before calling management services', async () => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    const prisma = app.get<PrismaService>(PrismaService);
    await request(app.getHttpServer()).get('/admin/trips/not-a-uuid').set('Authorization', `Bearer ${adminToken}`).expect(400);
    await request(app.getHttpServer()).get('/admin/drivers/not-a-uuid').set('Authorization', `Bearer ${adminToken}`).expect(400);
    expect(prisma.drivers.findUnique).not.toHaveBeenCalled();
  });

  it('returns an explicitly paginated trip result with validated server filters', async () => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer())
      .get('/admin/trips?page=2&limit=25&status=live&search=Ana')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect({ items: [{ id: 'trip-a', status: 'ongoing' }], total: 41, page: 2, pageSize: 25 });
  });

  it('rejects repeated and overlong trip search parameters', async () => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer())
      .get('/admin/trips?search=ana&search=maria')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/admin/trips?search=${'x'.repeat(121)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('rejects unknown trip filters and malformed numeric service ids', async () => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer()).get('/admin/trips?unexpected=value')
      .set('Authorization', `Bearer ${adminToken}`).expect(400);
    await request(app.getHttpServer()).post('/admin/services/not-a-number')
      .set('Authorization', `Bearer ${adminToken}`).send({ base_fare: 500 }).expect(400);
  });

  it('restricts payment reconciliation to admins and returns settlement status', async () => {
    await request(app.getHttpServer()).get('/admin/payments').expect(401);
    const clientToken = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).get('/admin/payments').set('Authorization', `Bearer ${clientToken}`).expect(403);
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer())
      .get('/admin/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect({
        items: [{ id: 'payment-a', method: 'cash', amount: '950.00', status: 'pending', trips: { id: 'trip-a' }, profiles: null }],
        total: 1, page: 1, pageSize: 20,
        summary: { pendingCount: 1, confirmedCount: 1, confirmedCashTotal: 950, cashPendingTotal: 950 },
      });
  });

  it('returns paginated invoice data and full aggregate totals, rejecting repeated finance queries', async () => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer()).get('/admin/invoices?page=2&limit=10&type=ride&search=Client')
      .set('Authorization', `Bearer ${adminToken}`).expect(200)
      .expect(response => expect(response.body).toMatchObject({
        items: [expect.objectContaining({ id: 'invoice-a', invoice_type: 'ride' })], total: 1, page: 2, pageSize: 10,
        summary: { receiptTotal: 950, invoiceTypes: ['ride', 'delivery'] },
      }));
    await request(app.getHttpServer()).get('/admin/payments?page=2&limit=10&status=confirmed&search=client')
      .set('Authorization', `Bearer ${adminToken}`).expect(200)
      .expect(response => expect(response.body).toMatchObject({
        items: [expect.objectContaining({ id: 'payment-a' })], total: 1, page: 2, pageSize: 10,
      }));
    await request(app.getHttpServer()).get('/admin/invoices?type=ride&type=delivery')
      .set('Authorization', `Bearer ${adminToken}`).expect(400);
    await request(app.getHttpServer()).get('/admin/payments?status=pending&status=confirmed')
      .set('Authorization', `Bearer ${adminToken}`).expect(400);
    await request(app.getHttpServer()).get(`/admin/payments?search=${'x'.repeat(121)}`)
      .set('Authorization', `Bearer ${adminToken}`).expect(400);
  });

  it('restricts per-user invoice lookup to admins', async () => {
    await request(app.getHttpServer()).get(`/admin/invoices/user/${adminClientRouteId}`).expect(401);
    const clientToken = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).get(`/admin/invoices/user/${adminClientRouteId}`)
      .set('Authorization', `Bearer ${clientToken}`).expect(403);

    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer()).get(`/admin/invoices/user/${adminClientRouteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(response => expect(response.body).toEqual([expect.objectContaining({ id: 'invoice-a', amount: '950.00', invoice_type: 'ride' })]));
  });

  it('restricts client status mutations to admins', async () => {
    await request(app.getHttpServer()).post(`/admin/clients/${adminClientRouteId}/status`).send({ status: 'suspended' }).expect(401);
    const clientToken = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).post(`/admin/clients/${adminClientRouteId}/status`)
      .set('Authorization', `Bearer ${clientToken}`).send({ status: 'suspended' }).expect(403);

    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer()).post(`/admin/clients/${adminClientRouteId}/status`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'suspended' })
      .expect(201).expect({ success: true });
  });

  it('restricts driver status mutations to admins', async () => {
    await request(app.getHttpServer()).post(`/admin/drivers/${adminDriverRouteId}/status`).send({ status: 'rejected' }).expect(401);
    const clientToken = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).post(`/admin/drivers/${adminDriverRouteId}/status`)
      .set('Authorization', `Bearer ${clientToken}`).send({ status: 'rejected' }).expect(403);

    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer()).post(`/admin/drivers/${adminDriverRouteId}/status`)
      .set('Authorization', `Bearer ${adminToken}`).send({ status: 'rejected' })
      .expect(201).expect({ success: true });
  });

  it('rejects a client token on an admin management route', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .get('/admin/drivers')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows an admin token to access a management list', () => {
    const token = jwt.sign({ sub: 'admin-a', role: 'admin' });
    return request(app.getHttpServer())
      .get('/admin/drivers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 20, items: [expect.objectContaining({ id: 'driver-a', full_name: 'Driver A' })] });
        expect(response.body.items[0]).not.toHaveProperty('password');
        expect(response.body.items[0]).not.toHaveProperty('password_hash');
        expect(response.body.items[0]).not.toHaveProperty('doc_bi_frente');
        expect(response.body.items[0]).not.toHaveProperty('doc_bi_verso');
        expect(response.body.items[0]).not.toHaveProperty('doc_carta_conducao');
      });
  });

  it('returns filtered and paginated drivers and rejects repeated query parameters', async () => {
    const token = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer()).get('/admin/drivers?page=2&limit=10&status=active&search=Driver')
      .set('Authorization', `Bearer ${token}`).expect(200)
      .expect(response => expect(response.body).toMatchObject({
        items: [expect.objectContaining({ id: 'driver-a', full_name: 'Driver A' })], total: 1, page: 2, pageSize: 10,
      }));
    await request(app.getHttpServer()).get('/admin/drivers?status=active&status=pending')
      .set('Authorization', `Bearer ${token}`).expect(400);
    await request(app.getHttpServer()).get(`/admin/drivers?search=${'x'.repeat(121)}`)
      .set('Authorization', `Bearer ${token}`).expect(400);
  });

  it('returns owner-filtered paginated trip histories and summaries', async () => {
    const token = jwt.sign({ sub: 'admin-a', role: 'admin' });
    const prisma = app.get<PrismaService>(PrismaService);
    await request(app.getHttpServer()).get(`/admin/clients/${adminClientRouteId}/trips?page=2&limit=10`)
      .set('Authorization', `Bearer ${token}`).expect(200)
      .expect({ items: [{ id: 'trip-a', status: 'ongoing' }], total: 41, page: 2, pageSize: 10, summary: { confirmedSpend: 950 } });
    await request(app.getHttpServer()).get(`/admin/drivers/${adminDriverRouteId}/trips?page=2&limit=10`)
      .set('Authorization', `Bearer ${token}`).expect(200)
      .expect({ items: [{ id: 'trip-a', status: 'ongoing' }], total: 41, page: 2, pageSize: 10, summary: { completedEarnings: 900 } });
    expect(prisma.trips.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { client_id: adminClientRouteId }, skip: 10, take: 10 }));
    expect(prisma.trips.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { driver_id: adminDriverRouteId }, skip: 10, take: 10 }));
  });

  it('omits credentials and personal documents from driver detail responses', () => {
    const token = jwt.sign({ sub: 'admin-a', role: 'admin' });
    return request(app.getHttpServer())
      .get(`/admin/drivers/${adminDriverRouteId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ id: 'driver-a', full_name: 'Driver A' });
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('doc_bi_frente');
        expect(response.body).not.toHaveProperty('doc_bi_verso');
        expect(response.body).not.toHaveProperty('doc_carta_conducao');
      });
  });

  it('returns only driver documents on the admin-only review endpoint', async () => {
    const clientToken = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).get(`/admin/drivers/${adminDriverRouteId}/documents`)
      .set('Authorization', `Bearer ${clientToken}`).expect(403);

    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer()).get(`/admin/drivers/${adminDriverRouteId}/documents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect({
        id: 'driver-a',
        doc_bi_frente: 'data:image/jpeg;base64,/9j/',
        doc_bi_verso: 'data:image/jpeg;base64,/9j/',
        doc_carta_conducao: 'data:image/jpeg;base64,/9j/',
      });
  });

  it('rejects unsupported driver vehicle categories on the admin route', async () => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer())
      .post(`/admin/drivers/${adminDriverRouteId}/vehicle-category`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vehicle_category: 'spaceship' })
      .expect(400);
  });

  it('rejects a vehicle category paired with an incompatible route mode', async () => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Moto', category: 'ride', service_type: 'moto', vehicle_category: 'moto', routing_mode: 'car',
        base_fare: 500, price_per_km: 150, price_per_min: 10, min_fare: 700,
        platform_fee_type: 'percentage', platform_fee_value: 10,
      })
      .expect(400);
  });

  it.each([
    ['/admin/services', { id: 9, name: 'Moto' }],
    ['/admin/services/9', { base_fare: 500, updated_at: '2026-10-17T00:00:00.000Z' }],
    ['/admin/configs/9', { base_fare: 500, id: 9 }],
  ])('rejects persistence-only pricing fields on %s', async (path, payload) => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(400);
  });

  it('accepts raster image uploads with server-generated names and rejects spoofed or oversized files', async () => {
    const adminToken = jwt.sign({ sub: 'admin-a', role: 'admin' });
    const clientToken = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).post('/admin/upload').set('Authorization', `Bearer ${adminToken}`).expect(400);
    await request(app.getHttpServer())
      .post('/admin/upload')
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'unauthorized.jpg', contentType: 'image/jpeg' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/admin/upload')
      .set('Authorization', `Bearer ${clientToken}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'client.jpg', contentType: 'image/jpeg' })
      .expect(403);
    const accepted = await request(app.getHttpServer())
      .post('/admin/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: '../../unsafe.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(accepted.body.url).toMatch(/^http:\/\/localhost:3000\/uploads\/services\/[0-9a-f-]+\.jpg$/i);
    const filename = accepted.body.url.split('/').pop();
    await unlink(join(process.cwd(), 'uploads', 'services', filename));

    const unicodeDoubleExtension = await request(app.getHttpServer())
      .post('/admin/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), { filename: 'imagem-área.jpg.png.svg', contentType: 'image/png' })
      .expect(201);
    expect(unicodeDoubleExtension.body.url).toMatch(/^http:\/\/localhost:3000\/uploads\/services\/[0-9a-f-]+\.png$/i);
    const unicodeFilename = unicodeDoubleExtension.body.url.split('/').pop();
    await unlink(join(process.cwd(), 'uploads', 'services', unicodeFilename));

    await request(app.getHttpServer())
      .post('/admin/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('<svg onload="alert(1)"/>'), { filename: 'icon.svg', contentType: 'image/jpeg' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/admin/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('<svg/>'), { filename: 'icon.svg', contentType: 'image/svg+xml' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/admin/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)]), { filename: 'large.jpg', contentType: 'image/jpeg' })
      .expect(413);
  });

  it('omits password hashes from client list responses', () => {
    const token = jwt.sign({ sub: 'admin-a', role: 'admin' });
    return request(app.getHttpServer())
      .get('/admin/clients')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({ items: [
          expect.objectContaining({ id: 'client-a', full_name: 'Client A', paidTripsCount: 2 }),
        ], total: 1, page: 1, pageSize: 20 });
        expect(response.body.items[0]).not.toHaveProperty('password_hash');
      });
  });
});
