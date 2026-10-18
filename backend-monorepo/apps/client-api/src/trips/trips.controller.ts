import { BadRequestException, Controller, Post, Body, UseGuards, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/auth';
import type { AuthUser } from '@app/auth';

const HISTORY_QUERY_KEYS = new Set(['limit', 'status', 'month', 'year', 'category', 'page', 'role']);
const HISTORY_STATUSES = new Set(['all', 'requested', 'accepted', 'ongoing', 'completed', 'cancelled']);
const HISTORY_CATEGORIES = new Set(['ride', 'delivery']);

function singleValue(query: Record<string, unknown>, key: string): string | undefined {
    const value = query[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.length === 0) {
        throw new BadRequestException(`O parâmetro ${key} deve ser informado uma única vez.`);
    }
    return value;
}

function boundedInteger(value: string | undefined, key: string, fallback: number, min: number, max: number): number {
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
@Roles('client')
export class TripsController {
    constructor(private readonly tripsService: TripsService) { }

    @Post()
    create(@Body() createTripDto: CreateTripDto, @CurrentUser() user: AuthUser) {
        return this.tripsService.create(createTripDto, user.sub);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
        return this.tripsService.findOneForClient(id, user.sub);
    }

    @Get('active/:userId')
    findActive(@CurrentUser() user: AuthUser) {
        return this.tripsService.findActive(user.sub);
    }

    @Get('history/:userId')
    getHistory(@CurrentUser() user: AuthUser, @Query() query: Record<string, unknown>) {
        for (const key of Object.keys(query)) {
            if (!HISTORY_QUERY_KEYS.has(key)) throw new BadRequestException(`Parâmetro desconhecido: ${key}.`);
        }
        const role = singleValue(query, 'role');
        if (role !== undefined && role !== 'client') throw new BadRequestException('O parâmetro role deve ser client.');

        const limit = boundedInteger(singleValue(query, 'limit'), 'limit', 20, 1, 100);
        const page = boundedInteger(singleValue(query, 'page'), 'page', 1, 1, 100_000);
        const monthText = singleValue(query, 'month');
        const yearText = singleValue(query, 'year');
        if ((monthText === undefined) !== (yearText === undefined)) {
            throw new BadRequestException('Os parâmetros month e year devem ser informados juntos.');
        }
        const month = monthText === undefined ? undefined : boundedInteger(monthText, 'month', 0, 1, 12) - 1;
        const year = yearText === undefined ? undefined : boundedInteger(yearText, 'year', 2000, 2000, 9999);
        const status = singleValue(query, 'status');
        if (status !== undefined && !HISTORY_STATUSES.has(status)) throw new BadRequestException('Status inválido para o histórico.');
        const category = singleValue(query, 'category');
        if (category !== undefined && !HISTORY_CATEGORIES.has(category)) throw new BadRequestException('Categoria inválida para o histórico.');

        return this.tripsService.getHistory(
            user.sub,
            limit,
            status,
            month,
            year,
            category,
            page
        );
    }

    @Get('stats/monthly/:userId')
    getMonthlyStats(@CurrentUser() user: AuthUser) {
        return this.tripsService.getMonthlyStats(user.sub);
    }
}
