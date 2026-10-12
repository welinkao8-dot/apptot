import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import { AuthService } from './auth.service';

describe('admin login contract', () => {
  const jwt = new JwtService({ secret: 'admin-login-test-secret' });
  const service = new AuthService({} as PrismaService, jwt);

  it('preserves token, user and email while issuing the admin subject and role', async () => {
    const admin = {
      id: 'admin-subject',
      email: 'admin@example.test',
      role: 'spoofed',
    };
    const result = await service.login(admin);
    expect(Object.keys(result).sort()).toEqual(['token', 'user']);
    expect(result.user).toEqual(admin);
    expect(jwt.verify(result.token)).toMatchObject({
      sub: 'admin-subject',
      role: 'admin',
      email: 'admin@example.test',
    });
  });

  it.each([undefined, '', '   ', 123])(
    'refuses to sign an invalid subject: %p',
    async (id) => {
      await expect(
        service
          .login({ id, email: 'admin@example.test' })
          .then(() => undefined),
      ).rejects.toThrow();
    },
  );
});
