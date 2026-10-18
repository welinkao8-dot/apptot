import { BadRequestException, Controller, Get, ParseFloatPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '@app/auth';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('client')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('map-config')
  mapConfig() {
    return this.locationsService.mapConfig();
  }

  @Get('autosuggest')
  autosuggest(@Query() params: Record<string, unknown>) {
    const allowedKeys = new Set(['q', 'lat', 'lng']);
    for (const key of Object.keys(params)) {
      if (!allowedKeys.has(key)) throw new BadRequestException(`Parâmetro desconhecido: ${key}.`);
    }
    const query = params.q;
    if (query !== undefined && typeof query !== 'string') {
      throw new BadRequestException('O parâmetro q deve ser informado uma única vez.');
    }
    const parseCoordinate = (key: 'lat' | 'lng'): number | undefined => {
      const value = params[key];
      if (value === undefined) return undefined;
      if (typeof value !== 'string' || value.trim() === '') {
        throw new BadRequestException(`O parâmetro ${key} deve ser informado uma única vez.`);
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new BadRequestException(`O parâmetro ${key} deve ser numérico.`);
      return parsed;
    };
    const lat = parseCoordinate('lat');
    const lng = parseCoordinate('lng');
    if ((lat === undefined) !== (lng === undefined)) throw new BadRequestException('Informe latitude e longitude em conjunto.');
    return this.locationsService.autosuggest((query as string | undefined) ?? '', lat, lng);
  }

  @Get('reverse-geocode')
  reverseGeocode(
    @Query('lat', new ParseFloatPipe()) lat: number,
    @Query('lng', new ParseFloatPipe()) lng: number,
  ) {
    return this.locationsService.reverseGeocode(lat, lng);
  }
}
