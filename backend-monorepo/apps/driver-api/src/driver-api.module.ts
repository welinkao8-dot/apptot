import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DriverApiController } from './driver-api.controller';
import { DriverApiService } from './driver-api.service';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { DatabaseModule } from '@app/database';
import { RidesGateway } from './rides/rides.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    TripsModule,
  ],
  controllers: [DriverApiController],
  providers: [DriverApiService],
})
export class DriverApiModule { }
