import { BadRequestException, Body, Controller, Post, UseGuards, UnauthorizedException } from '@nestjs/common';
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
            throw new UnauthorizedException('Credenciais inválidas');
        }
        return this.authService.login(user); // Returns { access_token, driver }
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
            const profile = await this.prisma.profiles.findFirst({
                where: {
                    phone: String(body.phone).trim()
                }
            });

            return { exists: !!profile };
        } catch {
            return { exists: false };
        }
    }

    @Post('update-docs')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('driver')
    async updateDocs(@Body() body, @CurrentUser() user: AuthUser) {
        try {
            const { bi_frente, bi_verso, carta } = body;

            await this.prisma.drivers.update({
                where: { id: user.sub },
                data: {
                    doc_bi_frente: bi_frente,
                    doc_bi_verso: bi_verso,
                    doc_carta_conducao: carta,
                    status: 'pending' // Change from pending_docs to pending (awaiting admin approval)
                }
            });

            return { success: true };
        } catch {
            throw new BadRequestException('Não foi possível atualizar os documentos.');
        }
    }

    @Post('update-profile')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('driver')
    async updateProfile(@Body() body, @CurrentUser() user: AuthUser) {
        try {
            const { full_name, email, address } = body;
            const updatedUser = await this.authService.updateProfile(user.sub, { full_name, email, address });
            return { success: true, driver: updatedUser };
        } catch {
            throw new BadRequestException('Não foi possível atualizar o perfil.');
        }
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('driver')
    async changePassword(@Body() body, @CurrentUser() user: AuthUser) {
        try {
            const { currentPassword, newPassword } = body;
            return await this.authService.changePassword(user.sub, { currentPassword, newPassword });
        } catch {
            throw new BadRequestException('Não foi possível alterar a senha.');
        }
    }
}
