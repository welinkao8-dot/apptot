import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    TripsModule,
  ],
  controllers: [ClientApiController],
  providers: [ClientApiService],
})
export class ClientApiModule { }
