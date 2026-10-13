import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { RidesGateway } from '../rides/rides.gateway';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/auth';
import type { AuthUser } from '@app/auth';
import { PaymentsService } from '../payments/payments.service';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
    constructor(
        private readonly tripsService: TripsService,
        private readonly ridesGateway: RidesGateway,
        private readonly paymentsService: PaymentsService,
    ) { }

    @Post()
    @Roles('client')
    create(@Body() createTripDto: CreateTripDto, @CurrentUser() user: AuthUser) {
        return this.tripsService.create(createTripDto, user.sub);
    }

    @Get('pending')
    @Roles('driver')
    findPending(@CurrentUser() user: AuthUser) {
        return this.tripsService.findAllPending(user.sub);
    }

    @Get()
    @Roles('driver')
    findAll(@CurrentUser() user: AuthUser) {
        return this.tripsService.findAllForDriver(user.sub);
    }

    @Get('history/:userId')
    @Roles('driver')
    getHistory(
        @CurrentUser() user: AuthUser,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('month') month?: string,
        @Query('year') year?: string,
    ) {
        return this.tripsService.getHistory(
            user.sub,
            'driver',
            limit ? parseInt(limit) : 20,
            status,
            month ? parseInt(month) : undefined,
            year ? parseInt(year) : undefined
        );
    }

    @Get('stats/monthly/:userId')
    @Roles('driver')
    getMonthlyStats(@CurrentUser() user: AuthUser) {
        return this.tripsService.getMonthlyStats(user.sub, 'driver');
    }

    @Get('stats/:userId')
    @Roles('driver')
    getDailyStats(@CurrentUser() user: AuthUser) {
        return this.tripsService.getDailyStats(user.sub);
    }

    @Get(':id')
    @Roles('driver')
    findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.tripsService.findOneForDriver(id, user.sub);
    }

    @Get(':id/payment')
    @Roles('driver')
    getPayment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.paymentsService.getPaymentForDriver(id, user.sub);
    }
}
