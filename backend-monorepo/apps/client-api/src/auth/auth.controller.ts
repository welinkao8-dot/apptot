import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '@app/database';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/auth';
import type { AuthUser } from '@app/auth';

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
            throw new BadRequestException('Credenciais inválidas');
        }
        return this.authService.login(user);
    }

    @Post('register')
    async register(@Body() body) {
        try {
            return await this.authService.register(body);
        } catch {
            throw new BadRequestException('Não foi possível concluir o cadastro.');
        }
    }

    @Post('check-phone')
    async checkPhone(@Body() body) {
        try {
            const user = await this.prisma.profiles.findFirst({
                where: { phone: body.phone }
            });
            return { exists: !!user };
        } catch {
            return { exists: false };
        }
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('client')
    async changePassword(@Body() body, @CurrentUser() user: AuthUser) {
        return this.authService.changePassword(user.sub, body.oldPassword, body.newPassword);
    }

    @Post('update-profile')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('client')
    async updateProfile(@Body() body, @CurrentUser() user: AuthUser) {
        return this.authService.updateProfile(user.sub, { fullName: body.fullName, email: body.email });
    }
}
