import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { DatabaseModule } from '@app/database';
import { AuthModule } from '../auth/auth.module';
import { QuotesModule } from '../quotes/quotes.module';

@Module({
    imports: [DatabaseModule, AuthModule, QuotesModule],
    controllers: [TripsController],
    providers: [TripsService],
})
export class TripsModule { }
