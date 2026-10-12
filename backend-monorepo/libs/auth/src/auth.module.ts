import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { requireJwtSecret } from './jwt-config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({})
export class AuthModule {
  static register(
    options: Pick<JwtSignOptions, 'expiresIn'> = { expiresIn: '1d' },
  ): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        ConfigModule,
        PassportModule.register({ defaultStrategy: 'jwt', session: false }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: requireJwtSecret(config),
            signOptions: { expiresIn: options.expiresIn, algorithm: 'HS256' },
            verifyOptions: { algorithms: ['HS256'] },
          }),
        }),
      ],
      providers: [JwtStrategy, JwtAuthGuard, RolesGuard],
      exports: [
        JwtModule,
        PassportModule,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
      ],
    };
  }
}
