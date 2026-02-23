import { Controller, Request, Post, UseGuards, Body, Get, UnauthorizedException } from '@nestjs/common';
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
            throw new UnauthorizedException('Credenciais inválidas');
        }
        return this.authService.login(user); // Returns { access_token, driver }
    }

    @Post('register')
    async register(@Body() body) {
        try {
            console.log('Driver registration request:', body);
            const result = await this.authService.register(body);
            console.log('Driver registration success');
            return result;
        } catch (error) {
            console.error('Driver registration error:', error.message, error.stack);
            throw error;
        }
    }

    @Post('check-phone')
    async checkPhone(@Body() body) {
        try {
            console.log(`[CheckPhone] Verifying phone: ${body.phone}`);

            // FIXED: Query 'profiles' table globally. checking only 'driver' caused contradiction
            // where a 'client' profile would return exists=false but fail registration.
            const profile = await this.prisma.profiles.findFirst({
                where: {
                    phone: String(body.phone).trim()
                }
            });

            console.log(`[CheckPhone] Result for ${body.phone}: ${!!profile}`);
            return { exists: !!profile };
        } catch (error) {
            console.error('Check phone error:', error);
            return { exists: false };
        }
    }

    @Post('update-docs')
    async updateDocs(@Body() body) {
        try {
            console.log('Update docs request received.');
            console.log('Body keys:', Object.keys(body));
            if (body.bi_frente) console.log('bi_frente length:', body.bi_frente.length);
            if (body.bi_verso) console.log('bi_verso length:', body.bi_verso.length);
            if (body.carta) console.log('carta length:', body.carta.length);

            // FIX: Map frontend keys (bi_frente) to DB keys (doc_bi_frente)
            const { driverId, bi_frente, bi_verso, carta } = body;

            const updatedDriver = await this.prisma.drivers.update({
                where: { id: driverId },
                data: {
                    doc_bi_frente: bi_frente,
                    doc_bi_verso: bi_verso,
                    doc_carta_conducao: carta,
                    status: 'pending' // Change from pending_docs to pending (awaiting admin approval)
                }
            });

            console.log('Docs updated successfully');
            return { success: true, driver: updatedDriver };
        } catch (error) {
            console.error('Update docs error:', error.message, error.stack);
            throw error;
        }
    }

    @Post('update-profile')
    async updateProfile(@Body() body) {
        try {
            const { driverId, full_name, email, address } = body;
            const updatedUser = await this.authService.updateProfile(driverId, { full_name, email, address });
            return { success: true, driver: updatedUser };
        } catch (error) {
            console.error('Update profile error:', error);
            throw error;
        }
    }

    @Post('change-password')
    async changePassword(@Body() body) {
        try {
            const { driverId, currentPassword, newPassword } = body;
            return await this.authService.changePassword(driverId, { currentPassword, newPassword });
        } catch (error) {
            console.error('Change password error:', error);
            throw error;
        }
    }
}
