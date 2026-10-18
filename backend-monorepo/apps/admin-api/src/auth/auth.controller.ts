import { Controller, Post, Body, UnauthorizedException, ForbiddenException, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { isCorsOriginAllowed } from '@app/auth';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './login.dto';

const REFRESH_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getAdminRefreshCookieOptions(isProduction = process.env.NODE_ENV === 'production') {
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict' as const,
        path: '/',
        maxAge: REFRESH_COOKIE_TTL_MS,
    };
}

export function getAdminRefreshCookieName(isProduction = process.env.NODE_ENV === 'production') {
    return isProduction ? '__Host-tot-admin-refresh' : 'tot_admin_refresh';
}

export function readAdminRefreshCookie(cookieHeader: string | undefined): string | undefined {
    for (const cookie of (cookieHeader ?? '').split(';')) {
        const separator = cookie.indexOf('=');
        if (separator < 0 || cookie.slice(0, separator).trim() !== getAdminRefreshCookieName()) continue;
        try {
            return decodeURIComponent(cookie.slice(separator + 1).trim());
        } catch {
            return undefined;
        }
    }
    return undefined;
}

@Controller('admin/auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() body: AdminLoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
        this.assertAllowedBrowserOrigin(request);
        const admin = await this.authService.validateAdmin(body.email, body.password);
        if (!admin) {
            throw new UnauthorizedException('E-mail ou senha incorretos');
        }
        const session = await this.authService.login(admin);
        response.cookie(getAdminRefreshCookieName(), session.refreshToken, getAdminRefreshCookieOptions());
        return { token: session.token, user: session.user };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
        this.assertAllowedBrowserOrigin(request);
        try {
            const session = await this.authService.refresh(readAdminRefreshCookie(request.headers.cookie));
            response.cookie(getAdminRefreshCookieName(), session.refreshToken, getAdminRefreshCookieOptions());
            return { token: session.token, user: session.user };
        } catch (error) {
            const { maxAge: _maxAge, ...cookieOptions } = getAdminRefreshCookieOptions();
            response.clearCookie(getAdminRefreshCookieName(), cookieOptions);
            throw error;
        }
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
        this.assertAllowedBrowserOrigin(request);
        await this.authService.logout(readAdminRefreshCookie(request.headers.cookie));
        const { maxAge: _maxAge, ...cookieOptions } = getAdminRefreshCookieOptions();
        response.clearCookie(getAdminRefreshCookieName(), cookieOptions);
    }

    private assertAllowedBrowserOrigin(request: Request) {
        if (!isCorsOriginAllowed(request.headers.origin)) {
            throw new ForbiddenException('Origem não autorizada para sessões do painel administrativo.');
        }
    }
}
