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
      .useValue({ drivers: { findMany: jest.fn().mockResolvedValue([]) } })
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
      .expect([]);
  });
});
