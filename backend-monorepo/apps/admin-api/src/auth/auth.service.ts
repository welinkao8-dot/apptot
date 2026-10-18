import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import { validateJwtClaims } from '@app/auth';
import * as bcrypt from 'bcrypt';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

function createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
}

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async validateAdmin(email: string, pass: string): Promise<any> {
        const admin = await this.prisma.profiles.findFirst({
            where: {
                email,
                role: 'admin'
            }
        });

        if (admin && admin.password_hash && (await bcrypt.compare(pass, admin.password_hash))) {
            const { password_hash, ...result } = admin;
            return result;
        }
        return null;
    }

    private createAccessToken(admin: any, sessionId: string) {
        const payload = {
            email: admin.email,
            sid: sessionId,
            ...validateJwtClaims({ sub: admin.id, role: 'admin' }),
        };
        return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
    }

    async login(admin: any) {
        const refreshToken = createRefreshToken();
        const session = await this.prisma.admin_auth_sessions.create({
            data: {
                admin_id: admin.id,
                refresh_token_hash: hashRefreshToken(refreshToken),
                expires_at: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
            },
            select: { id: true },
        });

        return {
            token: this.createAccessToken(admin, session.id),
            refreshToken,
            sessionId: session.id,
            user: admin,
        };
    }

    async refresh(refreshToken: string | undefined) {
        if (!refreshToken || typeof refreshToken !== 'string') {
            throw new UnauthorizedException('Sessão admin inválida ou expirada.');
        }

        const currentHash = hashRefreshToken(refreshToken);
        const now = new Date();
        const session = await this.prisma.admin_auth_sessions.findUnique({
            where: { refresh_token_hash: currentHash },
            include: {
                profiles: {
                    select: { id: true, email: true, full_name: true, avatar_url: true, role: true, status: true, phone: true },
                },
            },
        });

        if (!session || session.revoked_at || session.expires_at <= now || session.profiles?.role !== 'admin') {
            throw new UnauthorizedException('Sessão admin inválida ou expirada.');
        }

        const nextRefreshToken = createRefreshToken();
        const rotation = await this.prisma.admin_auth_sessions.updateMany({
            where: {
                id: session.id,
                refresh_token_hash: currentHash,
                revoked_at: null,
                expires_at: { gt: now },
            },
            data: {
                refresh_token_hash: hashRefreshToken(nextRefreshToken),
                last_used_at: now,
            },
        });

        if (rotation.count !== 1) {
            throw new UnauthorizedException('Sessão admin já utilizada ou revogada.');
        }

        const admin = session.profiles;
        return {
            token: this.createAccessToken(admin, session.id),
            refreshToken: nextRefreshToken,
            sessionId: session.id,
            user: admin,
        };
    }

    async logout(refreshToken: string | undefined) {
        if (!refreshToken) return;
        await this.prisma.admin_auth_sessions.updateMany({
            where: { refresh_token_hash: hashRefreshToken(refreshToken), revoked_at: null },
            data: { revoked_at: new Date() },
        });
    }
}
