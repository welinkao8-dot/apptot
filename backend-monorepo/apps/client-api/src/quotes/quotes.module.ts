import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { AuthModule } from '../auth/auth.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { HereRoutingProvider } from './here-routing.provider';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [QuotesController],
  providers: [QuotesService, HereRoutingProvider],
  exports: [QuotesService],
})
export class QuotesModule {}
