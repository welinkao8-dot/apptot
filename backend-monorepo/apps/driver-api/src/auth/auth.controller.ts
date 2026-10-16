import { BadRequestException, Body, Controller, Get, Post, UseGuards, UnauthorizedException, ValidationPipe, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '@app/database';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/auth';
import type { AuthUser } from '@app/auth';
import { DriverChangePasswordDto, DriverCheckPhoneDto, DriverLoginDto, DriverRegisterDto, DriverUpdateDocsDto, DriverUpdateProfileDto } from './auth.dto';
import { validateDriverDocumentImage } from './driver-document-validation';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private prisma: PrismaService
    ) { }

    @Post('login')
    async login(@Body() body: DriverLoginDto) {
        const user = await this.authService.validateUser(body.phone, body.password);
        if (!user) {
            throw new UnauthorizedException('Credenciais inválidas');
        }
        return this.authService.login(user); // Returns { access_token, driver }
    }

    @Post('register')
    async register(@Body() body: DriverRegisterDto) {
        try {
            return await this.authService.register(body);
        } catch {
            throw new BadRequestException('Não foi possível concluir o cadastro.');
        }
    }

    @Post('check-phone')
    async checkPhone(@Body() body: DriverCheckPhoneDto) {
        const profile = await this.prisma.profiles.findFirst({
            where: { phone: body.phone }
        });
        return { exists: !!profile };
    }

    @Post('update-docs')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('driver')
    async updateDocs(@Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) body: DriverUpdateDocsDto, @CurrentUser() user: AuthUser) {
        if (![body.bi_frente, body.bi_verso, body.carta].every(validateDriverDocumentImage)) {
            throw new BadRequestException('Cada documento deve ser uma imagem JPEG, PNG ou WebP válida com até 8 MB.');
        }
        const result = await this.prisma.drivers.updateMany({
            where: { id: user.sub, status: { in: ['pending_docs', 'pending'] } },
            data: {
                doc_bi_frente: body.bi_frente,
                doc_bi_verso: body.bi_verso,
                doc_carta_conducao: body.carta,
                status: 'pending',
            },
        });
        if (result.count !== 1) {
            throw new ForbiddenException('A conta já não está à espera de documentos.');
        }
        return { success: true };
    }

    @Get('me')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('driver')
    async me(@CurrentUser() user: AuthUser) {
        const [profile, driver] = await Promise.all([
            this.prisma.profiles.findUnique({ where: { id: user.sub }, select: { id: true, status: true } }),
            this.prisma.drivers.findUnique({ where: { id: user.sub }, select: { status: true, doc_bi_frente: true, doc_bi_verso: true, doc_carta_conducao: true } }),
        ]);
        if (!profile || !driver) throw new UnauthorizedException('Perfil de motorista não encontrado.');
        return {
            status: driver.status || profile.status,
            documents: {
                bi_frente: Boolean(driver.doc_bi_frente),
                bi_verso: Boolean(driver.doc_bi_verso),
                carta: Boolean(driver.doc_carta_conducao),
            },
        };
    }

    @Post('update-profile')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('driver')
    async updateProfile(@Body() body: DriverUpdateProfileDto, @CurrentUser() user: AuthUser) {
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
    async changePassword(@Body() body: DriverChangePasswordDto, @CurrentUser() user: AuthUser) {
        try {
            const { currentPassword, newPassword } = body;
            return await this.authService.changePassword(user.sub, { currentPassword, newPassword });
        } catch {
            throw new BadRequestException('Não foi possível alterar a senha.');
        }
    }
}
