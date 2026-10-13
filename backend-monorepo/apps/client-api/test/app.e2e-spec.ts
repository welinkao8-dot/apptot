import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { ClientApiModule } from './../src/client-api.module';

describe('ClientApiController (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const trip = {
    id: 'trip-b', client_id: 'client-b',
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
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ClientApiModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $transaction: jest.fn((callback) => callback({
          trip_quotes: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue(quote),
          },
          trips: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)) },
        })),
        trips: {
          findUnique: jest.fn().mockResolvedValue(trip),
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an unauthenticated client trip read', () => {
    return request(app.getHttpServer()).get('/trips/trip-b').expect(401);
  });

  it('requires client authentication to create a quote', () => {
    return request(app.getHttpServer()).post('/quotes').send({}).expect(401);
  });

  it('rejects a driver token on quote creation', () => {
    const token = jwt.sign({ sub: 'driver-a', role: 'driver' });
    return request(app.getHttpServer()).post('/quotes').set('Authorization', `Bearer ${token}`).send({}).expect(403);
  });

  it('rejects a driver token on a client trip route', () => {
    const token = jwt.sign({ sub: 'driver-a', role: 'driver' });
    return request(app.getHttpServer())
      .get('/trips/trip-b')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('rejects a client reading another client’s trip', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .get('/trips/trip-b')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows the client who owns a trip to read it', () => {
    const token = jwt.sign({ sub: 'client-b', role: 'client' });
    return request(app.getHttpServer())
      .get('/trips/trip-b')
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
      .send({
        quoteId: quote.id,
        price: '1',
      })
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
});
