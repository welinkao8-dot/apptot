import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@app/database';
import { AdminApiModule } from './../src/admin-api.module';

describe('AdminApiController (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'task-3-e2e-secret';
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AdminApiModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        drivers: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'driver-a', full_name: 'Driver A', phone: '900000000', status: 'active',
              password: 'driver-password', doc_bi_frente: 'front-document',
              doc_bi_verso: 'back-document', doc_carta_conducao: 'licence-document',
            },
          ]),
          findUnique: jest.fn().mockResolvedValue({
            id: 'driver-a', full_name: 'Driver A', phone: '900000000',
            password: 'driver-password', doc_bi_frente: 'front-document',
            doc_bi_verso: 'back-document', doc_carta_conducao: 'licence-document',
          }),
        },
        profiles: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'client-a', full_name: 'Client A', phone: '911111111', role: 'client',
              password_hash: 'client-hash', _count: { trips_trips_client_idToprofiles: 2 },
            },
          ]),
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

  it('rejects an unauthenticated management-list request', () => {
    return request(app.getHttpServer()).get('/admin/drivers').expect(401);
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
        expect(response.body).toEqual([expect.objectContaining({ id: 'driver-a', full_name: 'Driver A' })]);
        expect(response.body[0]).not.toHaveProperty('password');
        expect(response.body[0]).not.toHaveProperty('password_hash');
        expect(response.body[0]).not.toHaveProperty('doc_bi_frente');
        expect(response.body[0]).not.toHaveProperty('doc_bi_verso');
        expect(response.body[0]).not.toHaveProperty('doc_carta_conducao');
      });
  });

  it('omits credentials and personal documents from driver detail responses', () => {
    const token = jwt.sign({ sub: 'admin-a', role: 'admin' });
    return request(app.getHttpServer())
      .get('/admin/drivers/driver-a')
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

  it('omits password hashes from client list responses', () => {
    const token = jwt.sign({ sub: 'admin-a', role: 'admin' });
    return request(app.getHttpServer())
      .get('/admin/clients')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          expect.objectContaining({ id: 'client-a', full_name: 'Client A', paidTripsCount: 2 }),
        ]);
        expect(response.body[0]).not.toHaveProperty('password_hash');
      });
  });
});
