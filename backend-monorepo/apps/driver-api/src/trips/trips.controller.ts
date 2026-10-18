import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards, ValidationPipe, ParseUUIDPipe } from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { InvalidDriverLocationError, RidesGateway } from '../rides/rides.gateway';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/auth';
import type { AuthUser } from '@app/auth';
import { PaymentsService } from '../payments/payments.service';
import { UpdateDriverLocationDto } from './dto/update-driver-location.dto';

const DRIVER_HISTORY_QUERY_KEYS = new Set(['limit', 'status', 'month', 'year']);
const DRIVER_HISTORY_STATUSES = new Set(['all', 'requested', 'accepted', 'ongoing', 'completed', 'cancelled']);

function historyQueryValue(query: Record<string, unknown>, key: string): string | undefined {
    const value = query[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.length === 0) {
        throw new BadRequestException(`O parâmetro ${key} deve ser informado uma única vez.`);
    }
    return value;
}

function boundedHistoryInteger(value: string | undefined, key: string, fallback: number, min: number, max: number) {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) throw new BadRequestException(`O parâmetro ${key} deve ser um número inteiro válido.`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
        throw new BadRequestException(`O parâmetro ${key} deve estar entre ${min} e ${max}.`);
    }
    return parsed;
}

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

    @Post('location')
    @Roles('driver')
    async updateLocation(
        @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) fix: UpdateDriverLocationDto,
        @CurrentUser() user: AuthUser,
    ) {
        try {
            return await this.ridesGateway.processDriverLocation(user.sub, fix);
        } catch (error) {
            if (error instanceof InvalidDriverLocationError) throw new BadRequestException(error.message);
            throw error;
        }
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
        @Query() query: Record<string, unknown>,
    ) {
        for (const key of Object.keys(query)) {
            if (!DRIVER_HISTORY_QUERY_KEYS.has(key)) throw new BadRequestException(`Parâmetro desconhecido: ${key}.`);
        }
        const limit = boundedHistoryInteger(historyQueryValue(query, 'limit'), 'limit', 20, 1, 100);
        const monthText = historyQueryValue(query, 'month');
        const yearText = historyQueryValue(query, 'year');
        if ((monthText === undefined) !== (yearText === undefined)) {
            throw new BadRequestException('Os parâmetros month e year devem ser informados juntos.');
        }
        const month = monthText === undefined ? undefined : boundedHistoryInteger(monthText, 'month', 1, 1, 12);
        const year = yearText === undefined ? undefined : boundedHistoryInteger(yearText, 'year', 2000, 2000, 9999);
        const status = historyQueryValue(query, 'status');
        if (status !== undefined && !DRIVER_HISTORY_STATUSES.has(status)) {
            throw new BadRequestException('Status inválido para o histórico.');
        }
        return this.tripsService.getHistory(
            user.sub,
            'driver',
            limit,
            status,
            month,
            year,
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
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
        return this.tripsService.findOneForDriver(id, user.sub);
    }

    @Get(':id/payment')
    @Roles('driver')
    getPayment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
        return this.paymentsService.getPaymentForDriver(id, user.sub);
    }
}
