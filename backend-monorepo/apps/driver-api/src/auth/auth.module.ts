import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '@app/database';
// import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'tot_secret_key_2026',
      signOptions: { expiresIn: '60d' },
    }),
  ],
  providers: [AuthService], // JwtStrategy
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule { }
