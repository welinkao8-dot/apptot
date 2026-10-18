import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { ClientApiModule } from './../src/client-api.module';

describe('ClientApiController (e2e)', () => {
  const tripRouteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  let app: INestApplication;
  let jwt: JwtService;
  let prisma: any;
  const trip = {
    id: 'trip-b', client_id: 'client-b',
    trip_payment: { status: 'confirmed', method: 'cash', amount: '950.00' },
    invoices: [{ id: 'invoice-b', user_id: 'client-b', amount: '950.00' }],
    profiles_trips_driver_idToprofiles: {
      id: 'driver-a', full_name: 'Driver A', password_hash: 'driver-hash',
      password: 'driver-password', doc_bi_frente: 'front-document',
    },
    trip_quotes: { pricing_snapshot: { route: { polyline: 'persisted-route' } } },
  };
  const quote = {
    id: '3f4b7b62-1d57-4fa8-b6df-8c48e4c9d33a', client_id: 'client-a', consumed_at: null,
    origin_address: 'Origin', origin_lat: 1, origin_lng: 2, dest_address: 'Destination', dest_lat: 3, dest_lng: 4,
    estimated_fare: '950.00', service_config_id: 3, category: 'ride', delivery_info: null,
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'task-3-e2e-secret';
    process.env.API_RATE_LIMIT_LIMIT = '10';
  });

  beforeEach(async () => {
    prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      $transaction: jest.fn((callback) => callback({
        $queryRaw: jest.fn().mockResolvedValue([]),
        trip_quotes: {
          updateMany: jest.fn(({ where }) => Promise.resolve({ count: where.client_id === quote.client_id ? 1 : 0 })),
          findUnique: jest.fn(({ where }) => Promise.resolve(where.id === quote.id ? quote : null)),
        },
        trips: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        },
      })),
      trips: {
        findUnique: jest.fn((args: { where?: { id?: string; quote_id?: string } }) => Promise.resolve(args.where?.id === tripRouteId ? trip : null)),
        findMany: jest.fn(({ where }: { where: { client_id: string } }) => Promise.resolve(where.client_id === trip.client_id ? [trip] : [])),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      profiles: {
        update: jest.fn(({ where, data }) => Promise.resolve({ id: where.id, phone: '+244900000000', ...data })),
      },
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ClientApiModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
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
      response = await request(app.getHttpServer()).get('/');
    }
    expect(response?.status).toBe(429);
  });

  it('reports database readiness on the unauthenticated health route', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('rejects an unauthenticated client trip read', () => {
    return request(app.getHttpServer()).get(`/trips/${tripRouteId}`).expect(401);
  });

  it('rejects malformed map coordinates instead of silently routing around them', async () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).get('/locations/autosuggest?q=maianga&lat=not-a-number&lng=13.2')
      .set('Authorization', `Bearer ${token}`).expect(400);
  });

  it.each([
    '/locations/autosuggest?q=maianga&unexpected=1',
    '/locations/autosuggest?q=maianga&q=talatona',
  ])('rejects unknown or repeated autosuggest query parameters: %s', async (path) => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`).expect(400);
  });

  it('rejects a malformed trip id before querying the database', async () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer()).get('/trips/not-a-uuid').set('Authorization', `Bearer ${token}`).expect(400);
    expect(prisma.trips.findUnique).not.toHaveBeenCalled();
  });

  it('requires client authentication to create a quote', () => {
    return request(app.getHttpServer()).post('/quotes').send({}).expect(401);
  });

  it('rejects malformed delivery recipient data before routing or persisting a quote', async () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    const payload = {
      category: 'delivery', originAddress: 'Origem', destAddress: 'Destino',
      originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3,
    };
    await request(app.getHttpServer()).post('/quotes').set('Authorization', `Bearer ${token}`).send(payload).expect(400);
    await request(app.getHttpServer()).post('/quotes').set('Authorization', `Bearer ${token}`).send({
      ...payload,
      deliveryInfo: { recipientName: 'Ana', recipientPhone: '123', packageDescription: 'Documentos' },
    }).expect(400);
    await request(app.getHttpServer()).post('/quotes').set('Authorization', `Bearer ${token}`).send({
      ...payload,
      deliveryInfo: { recipientName: 'Ana', recipientPhone: '923456789', packageDescription: 'Documentos', clientId: 'client-b' },
    }).expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a client-supplied quote owner instead of associating the quote with another user', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/quotes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'ride', originAddress: 'Origin', destAddress: 'Destination',
        originLat: -8.8, originLng: 13.2, destLat: -8.9, destLng: 13.3,
        clientId: 'client-b',
      })
      .expect(400);
  });

  it('rejects a driver token on quote creation', () => {
    const token = jwt.sign({ sub: 'driver-a', role: 'driver' });
    return request(app.getHttpServer()).post('/quotes').set('Authorization', `Bearer ${token}`).send({}).expect(403);
  });

  it('rejects a driver token on a client trip route', () => {
    const token = jwt.sign({ sub: 'driver-a', role: 'driver' });
    return request(app.getHttpServer())
      .get(`/trips/${tripRouteId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('rejects a client reading another client’s trip', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .get(`/trips/${tripRouteId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('does not let a client select another client’s active trips through the legacy userId path', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .get('/trips/active/client-b')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([]);
  });

  it('returns active trip payment details to the authenticated owner', async () => {
    const token = jwt.sign({ sub: 'client-b', role: 'client' });
    const response = await request(app.getHttpServer())
      .get('/trips/active/client-a')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(prisma.trips.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ client_id: 'client-b' }),
      include: expect.objectContaining({ trip_quotes: { select: { pricing_snapshot: true } } }),
    }));
    expect(response.body).toMatchObject([{
      id: 'trip-b', client_id: 'client-b', trip_payment: trip.trip_payment,
      route_polyline: 'persisted-route',
    }]);
    expect(response.body[0]).not.toHaveProperty('trip_quotes');
  });

  it('does not let a client select another client’s history or payment details through the legacy userId path', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .get('/trips/history/client-b')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([]);
  });

  it('applies the requested client history page using the authenticated owner', async () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer())
      .get('/trips/history/client-b?status=all&page=3&limit=15')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(prisma.trips.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ client_id: 'client-a' }),
      take: 15,
      skip: 30,
    }));
  });

  it.each([
    '/trips/history/client-b?limit=15items',
    '/trips/history/client-b?page=0',
    '/trips/history/client-b?page=1&page=2',
    '/trips/history/client-b?status=completed&status=cancelled',
    '/trips/history/client-b?month=13&year=2026',
    '/trips/history/client-b?month=2',
    '/trips/history/client-b?year=1999&month=2',
    '/trips/history/client-b?status=pending',
    '/trips/history/client-b?category=parcel',
  ])('rejects malformed history filters: %s', async (path) => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });

    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(prisma.trips.findMany).not.toHaveBeenCalled();
  });

  it('accepts mobile history filters while deriving the owner only from JWT', async () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });

    await request(app.getHttpServer())
      .get('/trips/history/client-b?role=client&status=all&category=delivery&month=2&year=2026&page=2&limit=15')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(prisma.trips.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        client_id: 'client-a', category: 'delivery',
        created_at: { gte: new Date(2026, 1, 1), lte: new Date(2026, 2, 0, 23, 59, 59) },
      }),
      take: 15,
      skip: 15,
    }));
  });

  it('uses the authenticated subject for monthly stats despite a different path userId', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .get('/trips/stats/monthly/client-b')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ count: 0, total: 0 });
  });

  it('allows the client who owns a trip to read it', () => {
    const token = jwt.sign({ sub: 'client-b', role: 'client' });
    return request(app.getHttpServer())
      .get(`/trips/${tripRouteId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ id: 'trip-b', client_id: 'client-b' });
        const driver = response.body.profiles_trips_driver_idToprofiles;
        expect(driver).toMatchObject({ id: 'driver-a', full_name: 'Driver A' });
        expect(driver).not.toHaveProperty('password');
        expect(driver).not.toHaveProperty('password_hash');
        expect(driver).not.toHaveProperty('doc_bi_frente');
      });
  });

  it('creates a trip from a quote for the authenticated client', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ quoteId: quote.id })
      .expect(201)
      .expect((response) => expect(response.body).toMatchObject({ client_id: 'client-a', estimated_fare: '950.00', quote_id: quote.id }));
  });

  it('rejects a trip request without a valid single-use quote', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ originAddress: 'Origin', destAddress: 'Destination', price: 1 })
      .expect(400);
  });

  it('rejects client-supplied fare fields instead of silently stripping or trusting them', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ quoteId: quote.id, price: '1' })
      .expect(400);
  });

  it('rejects a client trying to create a trip from another client’s quote', () => {
    const token = jwt.sign({ sub: 'client-b', role: 'client' });
    return request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ quoteId: quote.id })
      .expect(403);
  });

  it('updates only the profile identified by the authenticated JWT subject', async () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    await request(app.getHttpServer())
      .post('/auth/update-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: ' Ana Silva ' })
      .expect(201)
      .expect((response) => expect(response.body).toMatchObject({ id: 'client-a', full_name: 'Ana Silva' }));

    expect(prisma.profiles.update).toHaveBeenCalledWith({
      where: { id: 'client-a' },
      data: { full_name: 'Ana Silva', email: undefined },
    });
  });

  it('rejects a profile update naming another user in the body', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/auth/update-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Attacker name', userId: 'client-b' })
      .expect(400)
      .expect(() => expect(prisma.profiles.update).not.toHaveBeenCalled());
  });

  it('rejects a password change naming another user in the body', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'old-secret', newPassword: 'new-secret', userId: 'client-b' })
      .expect(400);
  });
});
