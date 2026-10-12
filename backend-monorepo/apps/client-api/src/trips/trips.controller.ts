import { Controller, Post, Body, UseGuards, Get, Param, Query } from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/auth';
import type { AuthUser } from '@app/auth';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('client')
export class TripsController {
    constructor(private readonly tripsService: TripsService) { }

    @Post()
    create(@Body() createTripDto: CreateTripDto, @CurrentUser() user: AuthUser) {
        return this.tripsService.create(createTripDto, user.sub);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.tripsService.findOneForClient(id, user.sub);
    }

    @Get('active/:userId')
    findActive(@CurrentUser() user: AuthUser) {
        return this.tripsService.findActive(user.sub);
    }

    @Get('history/:userId')
    getHistory(
        @CurrentUser() user: AuthUser,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('month') month?: string,
        @Query('year') year?: string,
        @Query('category') category?: string
    ) {
        return this.tripsService.getHistory(
            user.sub,
            limit ? parseInt(limit) : 20,
            status,
            month ? parseInt(month) : undefined,
            year ? parseInt(year) : undefined,
            category
        );
    }

    @Get('stats/monthly/:userId')
    getMonthlyStats(@CurrentUser() user: AuthUser) {
        return this.tripsService.getMonthlyStats(user.sub);
    }
}
