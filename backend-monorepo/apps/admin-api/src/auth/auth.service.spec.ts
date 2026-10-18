import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import { AuthService } from './auth.service';

describe('admin session lifecycle', () => {
  const jwt = new JwtService({ secret: 'admin-login-test-secret' });

  function createService() {
    const prisma = {
      admin_auth_sessions: {
        create: jest.fn().mockResolvedValue({ id: 'session-id' }),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    return { prisma, service: new AuthService(prisma, jwt) };
  }

  it('stores only a hash of the refresh token and returns a short-lived access token', async () => {
    const { prisma, service } = createService();
    const admin = { id: 'admin-subject', email: 'admin@example.test', role: 'spoofed' };

    const result = await service.login(admin);

    expect(result.user).toEqual(admin);
    expect(result.sessionId).toBe('session-id');
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const stored = (prisma.admin_auth_sessions.create as jest.Mock).mock.calls[0][0].data;
    expect(stored.refresh_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.refresh_token_hash).not.toBe(result.refreshToken);
    const claims = jwt.verify<{ sub: string; role: string; sid: string; exp: number; iat: number }>(result.token);
    expect(claims).toMatchObject({ sub: 'admin-subject', role: 'admin', sid: 'session-id' });
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(15 * 60);
  });

  it.each([undefined, '', '   ', 123])('refuses to sign an invalid subject: %p', async id => {
    const { service } = createService();
    await expect(service.login({ id, email: 'admin@example.test' })).rejects.toThrow();
  });

  it('rotates a refresh token once and refuses the previous token', async () => {
    const { prisma, service } = createService();
    const oldRefreshToken = 'old-refresh-token';
    (prisma.admin_auth_sessions.findUnique as jest.Mock).mockResolvedValue({
      id: 'session-id',
      admin_id: 'admin-subject',
      refresh_token_hash: 'unused',
      expires_at: new Date(Date.now() + 60_000),
      revoked_at: null,
      profiles: { id: 'admin-subject', email: 'admin@example.test', role: 'admin' },
    });

    const result = await service.refresh(oldRefreshToken);

    expect(result.refreshToken).not.toBe(oldRefreshToken);
    expect(prisma.admin_auth_sessions.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'session-id', revoked_at: null }),
      data: expect.objectContaining({ refresh_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    }));
    expect(jwt.verify(result.token)).toMatchObject({ sid: 'session-id', role: 'admin' });
  });

  it('revokes the refresh session on logout', async () => {
    const { prisma, service } = createService();
    await service.logout('refresh-token');
    expect(prisma.admin_auth_sessions.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ refresh_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/), revoked_at: null }),
      data: expect.objectContaining({ revoked_at: expect.any(Date) }),
    }));
  });
});
