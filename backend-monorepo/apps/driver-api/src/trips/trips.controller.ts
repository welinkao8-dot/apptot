import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { RidesGateway } from '../rides/rides.gateway';

@Controller('trips')
export class TripsController {
    constructor(
        private readonly tripsService: TripsService,
        private readonly ridesGateway: RidesGateway
    ) { }

    @Post()
    create(@Body() createTripDto: CreateTripDto) {
        return this.tripsService.create(createTripDto);
    }

    @Get('pending')
    findPending() {
        return this.tripsService.findAllPending();
    }

    @Get()
    findAll() {
        return this.tripsService.findAll();
    }

    @Get('history/:userId')
    getHistory(
        @Param('userId') userId: string,
        @Query('role') role: 'client' | 'driver',
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('month') month?: string,
        @Query('year') year?: string
    ) {
        return this.tripsService.getHistory(
            userId,
            role,
            limit ? parseInt(limit) : 20,
            status,
            month ? parseInt(month) : undefined,
            year ? parseInt(year) : undefined
        );
    }

    @Get('stats/monthly/:userId')
    getMonthlyStats(@Param('userId') userId: string, @Query('role') role: 'client' | 'driver') {
        return this.tripsService.getMonthlyStats(userId, role);
    }

    @Get('stats/:userId')
    getDailyStats(@Param('userId') userId: string) {
        return this.tripsService.getDailyStats(userId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.tripsService.findOne(id);
    }
}
