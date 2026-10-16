import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { DatabaseModule } from '@app/database';
import { QuotesModule } from './quotes/quotes.module';
import { LocationsModule } from './locations/locations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    TripsModule,
    QuotesModule,
    LocationsModule,
  ],
  controllers: [ClientApiController],
  providers: [ClientApiService],
})
export class ClientApiModule { }
