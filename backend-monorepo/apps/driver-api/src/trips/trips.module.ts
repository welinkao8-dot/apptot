import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { DatabaseModule } from '@app/database';
import { RidesGateway } from '../rides/rides.gateway';
import { AuthModule } from '../auth/auth.module';
import { PaymentsService } from '../payments/payments.service';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [TripsController],
    providers: [TripsService, PaymentsService, RidesGateway],
    exports: [TripsService, RidesGateway],
})
export class TripsModule { }
