import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { DatabaseModule } from '@app/database';
import { RidesGateway } from '../rides/rides.gateway';

@Module({
    imports: [DatabaseModule],
    controllers: [TripsController],
    providers: [TripsService, RidesGateway],
    exports: [TripsService, RidesGateway],
})
export class TripsModule { }
