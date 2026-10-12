import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import { AuthService } from './auth.service';

describe('driver login contract', () => {
  const jwt = new JwtService({ secret: 'driver-login-test-secret' });
  const service = new AuthService({} as PrismaService, jwt);

  it('preserves token, driver and phone while issuing the driver subject and role', async () => {
    const driver = {
      id: 'driver-subject',
      phone: 'test-phone',
      role: 'spoofed',
    };
    const result = await service.login(driver);
    expect(Object.keys(result).sort()).toEqual(['driver', 'token']);
    expect(result.driver).toEqual(driver);
    expect(jwt.verify(result.token)).toMatchObject({
      sub: 'driver-subject',
      role: 'driver',
      phone: 'test-phone',
    });
  });

  it.each([undefined, '', '   ', 123])(
    'refuses to sign an invalid subject: %p',
    async (id) => {
      await expect(
        service.login({ id, phone: 'test-phone' }).then(() => undefined),
      ).rejects.toThrow();
    },
  );
});
