import { Controller, Post, Body, UseGuards, Request, Get, Param, Query } from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
// import { JwtAuthGuard } from ... (Would implementation JWT Guard later)
// For now, passing ID or assuming middleware usage, but let's be cleaner.

@Controller('trips')
export class TripsController {
    constructor(private readonly tripsService: TripsService) { }

    @Post()
    create(@Body() createTripDto: CreateTripDto, @Body('userId') userId: string) {
        // In real app, get userId from @Request() req.user
        return this.tripsService.create(createTripDto, userId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.tripsService.findOne(id);
    }

    @Get('active/:userId')
    findActive(@Param('userId') userId: string) {
        return this.tripsService.findActive(userId);
    }

    @Get('history/:userId')
    getHistory(
        @Param('userId') userId: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('month') month?: string,
        @Query('year') year?: string,
        @Query('category') category?: string
    ) {
        return this.tripsService.getHistory(
            userId,
            limit ? parseInt(limit) : 20,
            status,
            month ? parseInt(month) : undefined,
            year ? parseInt(year) : undefined,
            category
        );
    }

    @Get('stats/monthly/:userId')
    getMonthlyStats(@Param('userId') userId: string) {
        return this.tripsService.getMonthlyStats(userId);
    }
}
