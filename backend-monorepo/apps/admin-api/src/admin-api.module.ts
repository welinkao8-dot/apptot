import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminApiController } from './admin-api.controller';
import { AdminApiService } from './admin-api.service';
import { DatabaseModule } from '@app/database';
import { AdminGateway } from './admin-api.gateway';
import { AuthModule } from './auth/auth.module';
import { DriverDocumentRetentionScheduler } from './driver-document-retention.scheduler';
import { QuotePreviewService } from './quote-preview.service';
import { HereRoutingProvider } from '../../../libs/routing/src/here-routing.provider';
import { ApiRateLimitModule } from '../../../libs/rate-limit/src/rate-limit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    ApiRateLimitModule,
  ],
  controllers: [AdminApiController],
  providers: [AdminApiService, AdminGateway, DriverDocumentRetentionScheduler, QuotePreviewService, HereRoutingProvider],
})
export class AdminApiModule { }
