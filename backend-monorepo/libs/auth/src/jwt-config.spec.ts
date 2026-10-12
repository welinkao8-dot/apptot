import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@app/database';
import { AuthModule as AdminAuthModule } from '../../../apps/admin-api/src/auth/auth.module';
import { AuthModule as ClientAuthModule } from '../../../apps/client-api/src/auth/auth.module';
import { AuthModule as DriverAuthModule } from '../../../apps/driver-api/src/auth/auth.module';

const configuredSecret = 'task-2-configured-secret-for-tests-only';

describe.each([
  ['admin', AdminAuthModule, 86400],
  ['client', ClientAuthModule, 5184000],
  ['driver', DriverAuthModule, 5184000],
] as const)('%s JWT configuration', (role, authModule, lifetime) => {
  function compile(secret: unknown) {
    return Test.createTestingModule({ imports: [ConfigModule, authModule] })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined),
      })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  }

  it.each([undefined, '', '   ', '\t\n', 123])(
    'fails module configuration for missing or invalid JWT_SECRET (%p)',
    async (secret) => {
      await expect(compile(secret)).rejects.toThrow('JWT_SECRET');
    },
  );

  it('uses the configured secret for signing and verification', async () => {
    const module = await compile(configuredSecret);
    try {
      const jwt = module.get(JwtService);
      const independentJwt = new JwtService({ secret: configuredSecret });
      const claims = { sub: 'test-subject', role };
      const token = jwt.sign(claims);
      const verified = independentJwt.verify(token);

      expect(verified).toMatchObject(claims);
      expect(verified.exp - verified.iat).toBe(lifetime);
      expect(jwt.verify(independentJwt.sign(claims))).toMatchObject(claims);
      expect(() =>
        jwt.verify(
          new JwtService({ secret: 'different-test-secret' }).sign(claims),
        ),
      ).toThrow();
    } finally {
      await module.close();
    }
  });
});
