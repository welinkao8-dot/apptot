import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { DriverApiModule } from './../src/driver-api.module';
import { RidesGateway } from './../src/rides/rides.gateway';

describe('DriverApiController (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
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

  beforeAll(() => {
    process.env.JWT_SECRET = 'task-3-e2e-secret';
    jest.useFakeTimers();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DriverApiModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
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
    await app.init();
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('rejects an unauthenticated pending-trip list request', () => {
    return request(app.getHttpServer()).get('/trips/pending').expect(401);
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

  it('accepts an authenticated admin notification', () => {
    const token = jwt.sign({ sub: 'admin-a', role: 'admin' });
    return request(app.getHttpServer())
      .post('/notify-driver-status')
      .set('Authorization', `Bearer ${token}`)
      .send({ driverId: 'driver-a', status: 'active' })
      .expect(201)
      .expect({ success: true });
  });

  it('creates a trip for the authenticated client instead of body clientId', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: 'client-b',
        originAddress: 'Origin',
        destAddress: 'Destination',
        price: '100',
      })
      .expect(201)
      .expect((response) => expect(response.body).toMatchObject({ client_id: 'client-a' }));
  });
});
