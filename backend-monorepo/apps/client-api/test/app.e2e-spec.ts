import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { ClientApiModule } from './../src/client-api.module';

describe('ClientApiController (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const trip = { id: 'trip-b', client_id: 'client-b' };

  beforeAll(() => {
    process.env.JWT_SECRET = 'task-3-e2e-secret';
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ClientApiModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        trips: {
          findUnique: jest.fn().mockResolvedValue(trip),
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an unauthenticated client trip read', () => {
    return request(app.getHttpServer()).get('/trips/trip-b').expect(401);
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
      .expect(trip);
  });

  it('creates a trip for the authenticated client instead of a body userId', () => {
    const token = jwt.sign({ sub: 'client-a', role: 'client' });
    return request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: 'client-b',
        originAddress: 'Origin',
        destAddress: 'Destination',
        price: '100',
      })
      .expect(201)
      .expect((response) => expect(response.body).toMatchObject({ client_id: 'client-a' }));
  });
});
