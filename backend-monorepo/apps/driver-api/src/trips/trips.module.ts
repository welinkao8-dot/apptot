import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { DatabaseModule } from '@app/database';
import { RidesGateway } from '../rides/rides.gateway';
import { AuthModule } from '../auth/auth.module';
import { PaymentsService } from '../payments/payments.service';
import { DriverPushModule } from '../push/driver-push.module';

@Module({
    imports: [DatabaseModule, AuthModule, DriverPushModule],
    controllers: [TripsController],
    providers: [TripsService, PaymentsService, RidesGateway],
    exports: [TripsService, RidesGateway],
})
export class TripsModule { }
