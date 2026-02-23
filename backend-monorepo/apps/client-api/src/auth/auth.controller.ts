import { Controller, Post, Body, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '@app/database';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private prisma: PrismaService
    ) { }

    @Post('login')
    async login(@Body() body) {
        const user = await this.authService.validateUser(body.phone, body.password);
        if (!user) {
            throw new Error('Credenciais inválidas'); // Nest default exception filter handles 500/400? or 401? Ideally HttpEx
        }
        return this.authService.login(user);
    }

    @Post('register')
    async register(@Body() body) {
        try {
            console.log('Client registration request:', body);
            const result = await this.authService.register(body);
            console.log('Client registration success');
            return result;
        } catch (error) {
            console.error('Client registration error:', error.message, error.stack);
            throw error;
        }
    }

    @Post('check-phone')
    async checkPhone(@Body() body) {
        try {
            const user = await this.prisma.profiles.findFirst({
                where: { phone: body.phone }
            });
            return { exists: !!user };
        } catch (error) {
            console.error('Check phone error:', error);
            return { exists: false };
        }
    }
}
