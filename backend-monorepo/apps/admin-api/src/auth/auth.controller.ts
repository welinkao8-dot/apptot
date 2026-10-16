import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './login.dto';

@Controller('admin/auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    async login(@Body() body: AdminLoginDto) {
        const admin = await this.authService.validateAdmin(body.email, body.password);
        if (!admin) {
            throw new UnauthorizedException('E-mail ou senha incorretos');
        }
        return this.authService.login(admin);
    }
}
