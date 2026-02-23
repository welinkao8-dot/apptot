import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { DatabaseModule } from '@app/database';

@Module({
    imports: [DatabaseModule],
    controllers: [TripsController],
    providers: [TripsService],
})
export class TripsModule { }
