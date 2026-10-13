import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { DatabaseModule } from '@app/database';
import { QuotesModule } from './quotes/quotes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    TripsModule,
    QuotesModule,
  ],
  controllers: [ClientApiController],
  providers: [ClientApiService],
})
export class ClientApiModule { }
