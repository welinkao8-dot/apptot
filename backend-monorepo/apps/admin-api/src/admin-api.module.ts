import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminApiController } from './admin-api.controller';
import { AdminApiService } from './admin-api.service';
import { DatabaseModule } from '@app/database';
import { AdminGateway } from './admin-api.gateway';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule
  ],
  controllers: [AdminApiController],
  providers: [AdminApiService, AdminGateway],
})
export class AdminApiModule { }
