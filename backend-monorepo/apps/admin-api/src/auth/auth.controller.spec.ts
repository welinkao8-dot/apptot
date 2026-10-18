import type { Request, Response } from 'express';
import * as controllerModule from './auth.controller';

describe('admin browser session controller', () => {
  const { AuthController } = controllerModule;
  const service = {
    validateAdmin: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };
  const controller = new AuthController(service as any);
  const cookieHeader = 'tot_admin_refresh=refresh%2Btoken';

  beforeEach(() => jest.clearAllMocks());

  it('sets the refresh token only in an HttpOnly, SameSite Strict cookie', async () => {
    expect(typeof controllerModule.getAdminRefreshCookieOptions).toBe('function');
    expect(controllerModule.getAdminRefreshCookieOptions(false)).toMatchObject({
      httpOnly: true, secure: false, sameSite: 'strict', path: '/',
    });
    expect(controllerModule.getAdminRefreshCookieOptions(true)).toMatchObject({
      httpOnly: true, secure: true, sameSite: 'strict', path: '/',
    });
    service.validateAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    service.login.mockResolvedValue({ token: 'access-token', refreshToken: 'refresh-token', user: { id: 'admin-1' } });
    const response = { cookie: jest.fn() };

    const result = await controller.login(
      { email: 'admin@example.test', password: 'password' } as any,
      { headers: { origin: 'http://localhost:5175' } } as Request,
      response as unknown as Response,
    );

    expect(result).toEqual({ token: 'access-token', user: { id: 'admin-1' } });
    expect(JSON.stringify(result)).not.toContain('refresh-token');
    expect(response.cookie).toHaveBeenCalledWith('tot_admin_refresh', 'refresh-token', expect.objectContaining({
      httpOnly: true, sameSite: 'strict', path: '/',
    }));
  });

  it('rotates the refresh cookie after checking the exact browser origin', async () => {
    service.refresh.mockResolvedValue({ token: 'new-access', refreshToken: 'new-refresh', user: { id: 'admin-1' } });
    const response = { cookie: jest.fn() };

    const result = await controller.refresh(
      { headers: { origin: 'http://localhost:5175', cookie: cookieHeader } } as Request,
      response as unknown as Response,
    );

    expect(service.refresh).toHaveBeenCalledWith('refresh+token');
    expect(result).toEqual({ token: 'new-access', user: { id: 'admin-1' } });
    expect(response.cookie).toHaveBeenCalledWith('tot_admin_refresh', 'new-refresh', expect.any(Object));
  });

  it('rejects refresh or logout requests from origins outside the exact allowlist', async () => {
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };
    await expect(controller.refresh(
      { headers: { origin: 'https://evil.example', cookie: cookieHeader } } as Request,
      response as unknown as Response,
    )).rejects.toMatchObject({ status: 403 });
    await expect(controller.logout(
      { headers: { cookie: cookieHeader } } as Request,
      response as unknown as Response,
    )).rejects.toMatchObject({ status: 403 });
    expect(service.refresh).not.toHaveBeenCalled();
    expect(service.logout).not.toHaveBeenCalled();
  });

  it('revokes the server session and expires the cookie on logout', async () => {
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };

    await controller.logout(
      { headers: { origin: 'http://localhost:5175', cookie: cookieHeader } } as Request,
      response as unknown as Response,
    );

    expect(service.logout).toHaveBeenCalledWith('refresh+token');
    expect(response.clearCookie).toHaveBeenCalledWith('tot_admin_refresh', expect.objectContaining({
      httpOnly: true, sameSite: 'strict', path: '/',
    }));
  });
});
