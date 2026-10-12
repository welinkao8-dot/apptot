import { Module } from '@nestjs/common';
import { AuthModule as SharedAuthModule } from '@app/auth';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '@app/database';

@Module({
    imports: [
        DatabaseModule,
        SharedAuthModule.register({ expiresIn: '1d' }),
    ],
    controllers: [AuthController],
    providers: [AuthService],
    exports: [AuthService, SharedAuthModule],
})
export class AuthModule { }
