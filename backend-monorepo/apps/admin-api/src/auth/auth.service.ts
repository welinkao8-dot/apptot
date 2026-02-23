import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import * as bcrypt from 'bcrypt';

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

    async login(admin: any) {
        const payload = { email: admin.email, sub: admin.id, role: 'admin' };
        return {
            token: this.jwtService.sign(payload),
            user: admin,
        };
    }
}
