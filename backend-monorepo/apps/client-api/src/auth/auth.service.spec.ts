import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import { AuthService } from './auth.service';

describe('client login contract', () => {
  const jwt = new JwtService({ secret: 'client-login-test-secret' });
  const service = new AuthService({} as PrismaService, jwt);

  it('preserves token, user and phone while issuing the client subject and role', async () => {
    const user = { id: 'client-subject', phone: 'test-phone', role: 'spoofed' };
    const result = await service.login(user);
    expect(Object.keys(result).sort()).toEqual(['token', 'user']);
    expect(result.user).toEqual(user);
    expect(jwt.verify(result.token)).toMatchObject({
      sub: 'client-subject',
      role: 'client',
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
