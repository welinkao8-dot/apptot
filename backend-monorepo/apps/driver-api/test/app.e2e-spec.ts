import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { DriverApiModule } from './../src/driver-api.module';
import { RidesGateway } from './../src/rides/rides.gateway';

describe('DriverApiController (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let findAuthProfile: jest.Mock;
  const trip = { id: 'trip-b', client_id: 'client-a', driver_id: 'driver-b' };
  const assignedTrip = {
    id: 'trip-a', client_id: 'client-a', driver_id: 'driver-a',
    profiles_trips_client_idToprofiles: {
      id: 'client-a', full_name: 'Client A', password_hash: 'client-hash', password: 'client-password',
    },
    profiles_trips_driver_idToprofiles: {
      id: 'driver-a', full_name: 'Driver A', password_hash: 'driver-hash',
      password: 'driver-password', doc_bi_frente: 'front-document',
    },
  };
  const quote = {
    id: '3f4b7b62-1d57-4fa8-b6df-8c48e4c9d33a', client_id: 'client-a', consumed_at: null,
    origin_address: 'Origin', origin_lat: 1, origin_lng: 2, dest_address: 'Destination', dest_lat: 3, dest_lng: 4,
    estimated_fare: '950.00', service_config_id: 3, category: 'ride', delivery_info: null,
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'task-3-e2e-secret';
    process.env.INTERNAL_SERVICE_TOKEN = 'task-4-internal-service-token';
    jest.useFakeTimers();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DriverApiModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        profiles: {
          findFirst: (findAuthProfile = jest.fn().mockResolvedValue(null)),
        },
        drivers: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn((callback) => callback({
          $queryRaw: jest.fn().mockResolvedValue([]),
          trip_quotes: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue(quote),
          },
          trips: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
          },
        })),
        trips: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'trip-a' ? assignedTrip : trip)),
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        },
      })
      .overrideProvider(RidesGateway)
      .useValue({ notifyDriverAccountStatus: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllTimers();
  });

  it('reports database readiness on the unauthenticated health route', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('rejects an unauthenticated pending-trip list request', () => {
    return request(app.getHttpServer()).get('/trips/pending').expect(401);
  });

  it('returns the same generic login response for an unknown phone and a wrong password', async () => {
    findAuthProfile
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'driver-login',
        phone: '+244900000000',
        role: 'driver',
        password_hash: '$2b$10$C7qUnuw7LBGMex..UsA/OuOKjk74be2cR3D5mZU9ZdmIcwKzJ9RAS',
      });

    const unknownPhone = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '+244900000000', password: 'wrong-password' })
      .expect(401);
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '+244900000000', password: 'wrong-password' })
      .expect(401);

    expect(unknownPhone.body).toEqual(wrongPassword.body);
    expect(unknownPhone.body.message).toBe('Credenciais inválidas');
  });

  it('rejects malformed login data before querying driver profiles', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: 'x', password: '' })
      .expect(400);

    expect(findAuthProfile).not.toHaveBeenCalled();
  });

  it('rejects a client token on a driver pending-trip route', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .get('/trips/pending')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows a driver token to access pending trips', () => {
    const token = jwt.sign({ sub: 'driver-a', role: 'driver' });
    return request(app.getHttpServer())
      .get('/trips/pending')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([]);
  });

  it('rejects a driver reading a trip assigned to another driver', () => {
    const token = jwt.sign({ sub: 'driver-a', role: 'driver' });
    return request(app.getHttpServer())
      .get('/trips/trip-b')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('does not expose passwords or documents in an assigned trip response', () => {
    const token = jwt.sign({ sub: 'driver-a', role: 'driver' });
    return request(app.getHttpServer())
      .get('/trips/trip-a')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ id: 'trip-a', driver_id: 'driver-a' });
        for (const profile of [
          response.body.profiles_trips_client_idToprofiles,
          response.body.profiles_trips_driver_idToprofiles,
        ]) {
          expect(profile).toMatchObject({ full_name: expect.any(String) });
          expect(profile).not.toHaveProperty('password');
          expect(profile).not.toHaveProperty('password_hash');
          expect(profile).not.toHaveProperty('doc_bi_frente');
        }
      });
  });

  it('rejects a driver status notification without the internal service token', () => {
    return request(app.getHttpServer())
      .post('/notify-driver-status')
      .send({ driverId: 'driver-a', status: 'active' })
      .expect(403);
  });

  it('rejects a driver status notification with the wrong internal service token', () => {
    return request(app.getHttpServer())
      .post('/notify-driver-status')
      .set('x-internal-service-token', 'wrong-service-token')
      .send({ driverId: 'driver-a', status: 'active' })
      .expect(403);
  });

  it('accepts a driver status notification with the internal service token', () => {
    return request(app.getHttpServer())
      .post('/notify-driver-status')
      .set('x-internal-service-token', 'task-4-internal-service-token')
      .send({ driverId: 'driver-a', status: 'active' })
      .expect(201)
      .expect({ success: true });
  });

  it('creates a trip from a quote for the authenticated client', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        quoteId: quote.id,
      })
      .expect(201)
      .expect((response) => expect(response.body).toMatchObject({ client_id: 'client-a', estimated_fare: '950.00', quote_id: quote.id }));
  });

  it('rejects a trip request without a valid quote', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 'client-b', originAddress: 'Origin', price: 1 })
      .expect(400);
  });
});
