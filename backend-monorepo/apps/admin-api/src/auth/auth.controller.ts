import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('admin/auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    async login(@Body() body) {
        const admin = await this.authService.validateAdmin(body.email, body.password);
        if (!admin) {
            throw new UnauthorizedException('E-mail ou senha incorretos');
        }
        return this.authService.login(admin);
    }
}
