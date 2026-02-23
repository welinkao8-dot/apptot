import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async validateUser(phone: string, pass: string): Promise<any> {
        // Clients are in the PROFILES table
        const user = await this.prisma.profiles.findFirst({
            where: { phone }
        });

        if (user && user.password_hash && (await bcrypt.compare(pass, user.password_hash))) { // Legacy column: password_hash
            const { password_hash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const payload = { phone: user.phone, sub: user.id, role: 'client' }; // Enforce role client
        return {
            token: this.jwtService.sign(payload), // Changed from access_token
            user: user, // Frontend expects 'user'
        };
    }

    async register(data: any) {
        // Client Registration
        const { fullName, phone, password } = data;

        const existing = await this.prisma.profiles.findFirst({
            where: { phone }
        });

        if (existing) {
            throw new BadRequestException('Usuário já cadastrado.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await this.prisma.profiles.create({
            data: {
                full_name: fullName,
                phone: phone,
                password_hash: hashedPassword, // Legacy column name
                role: 'client',
                status: 'active'
            }
        });

        return this.login(user); // Auto-login
    }
}
