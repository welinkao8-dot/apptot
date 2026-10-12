import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as auth from './index';
const secret = 'task-2-http-secret-for-tests-only';

describe('shared HTTP authentication and roles', () => {
  let app: INestApplication;
  const signer = new JwtService({ secret, signOptions: { expiresIn: '1h' } });

  beforeAll(async () => {
    @Controller('auth-probe')
    @UseGuards(auth.JwtAuthGuard, auth.RolesGuard)
    class AuthProbeController {
      @Get('me')
      me(@auth.CurrentUser() user: unknown) {
        return user;
      }

      @Get('admin')
      @auth.Roles('admin')
      admin(@auth.CurrentUser() user: unknown) {
        return user;
      }

      @Get('mobile')
      @auth.Roles('client', 'driver')
      mobile(@auth.CurrentUser() user: unknown) {
        return user;
      }
    }

    @Controller('class-roles')
    @UseGuards(auth.JwtAuthGuard, auth.RolesGuard)
    @auth.Roles('admin')
    class ClassRolesController {
      @Get()
      admin() {
        return { allowed: true };
      }

      @Get('driver')
      @auth.Roles('driver')
      driver() {
        return { allowed: true };
      }
    }

    const module = await Test.createTestingModule({
      imports: [auth.AuthModule.register()],
      controllers: [AuthProbeController, ClassRolesController],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined),
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const access = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  it('rejects a request without a bearer token', async () => {
    await request(app.getHttpServer()).get('/auth-probe/me').expect(401);
  });

  it('does not authenticate a token supplied in a query parameter', async () => {
    await request(app.getHttpServer())
      .get('/auth-probe/me')
      .query({ token: signer.sign({ sub: 'subject', role: 'admin' }) })
      .expect(401);
  });

  it.each(['admin', 'client', 'driver'])(
    'accepts a verified %s subject and returns only actor claims',
    async (role) => {
      const token = signer.sign({
        sub: 'real-subject',
        role,
        userId: 'spoofed-subject',
        email: 'fixture@example.test',
      });
      const response = await access('/auth-probe/me', token).expect(200);
      expect(response.body).toEqual({ sub: 'real-subject', role });
    },
  );

  it.each([
    {},
    { role: 'client' },
    { sub: 'subject' },
    { sub: '', role: 'client' },
    { sub: '   ', role: 'client' },
    { sub: null, role: 'client' },
    { sub: 17, role: 'client' },
    { sub: ['subject'], role: 'client' },
    { sub: 'subject', role: 'superadmin' },
    { sub: 'subject', role: 'Admin' },
    { sub: 'subject', role: ['admin'] },
    { sub: 'subject', role: null },
  ])('rejects malformed verified claims: %p', async (claims) => {
    await access('/auth-probe/me', signer.sign(claims)).expect(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = new JwtService({ secret: 'wrong-test-secret' }).sign({
      sub: 'subject',
      role: 'admin',
    });
    await access('/auth-probe/me', token).expect(401);
  });

  it('rejects an expired token', async () => {
    await access(
      '/auth-probe/me',
      signer.sign({ sub: 'subject', role: 'admin' }, { expiresIn: -1 }),
    ).expect(401);
  });

  it('rejects a not-yet-valid token', async () => {
    await access(
      '/auth-probe/me',
      signer.sign({ sub: 'subject', role: 'admin' }, { notBefore: '1h' }),
    ).expect(401);
  });

  it('rejects a token signed with an unapproved algorithm', async () => {
    await access(
      '/auth-probe/me',
      signer.sign({ sub: 'subject', role: 'admin' }, { algorithm: 'HS384' }),
    ).expect(401);
  });

  it('rejects a malformed token', async () => {
    await access('/auth-probe/me', 'malformed-token').expect(401);
  });

  it.each(['client', 'driver'])(
    'rejects the %s role from an admin route',
    async (role) => {
      await access(
        '/auth-probe/admin',
        signer.sign({ sub: 'subject', role }),
      ).expect(403);
    },
  );

  it('accepts the required admin role', async () => {
    await access(
      '/auth-probe/admin',
      signer.sign({ sub: 'subject', role: 'admin' }),
    ).expect(200);
  });

  it.each(['client', 'driver'])(
    'accepts the %s role in a list of permitted roles',
    async (role) => {
      await access(
        '/auth-probe/mobile',
        signer.sign({ sub: 'subject', role }),
      ).expect(200);
    },
  );

  it('enforces class role metadata and a method override', async () => {
    const token = signer.sign({ sub: 'subject', role: 'driver' });
    await access('/class-roles', token).expect(403);
    await access('/class-roles/driver', token).expect(200);
  });
});
