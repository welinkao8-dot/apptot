import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
  autosuggest(
    @Query('q') query: string,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.locationsService.autosuggest(query, Number(lat), Number(lng));
  }

  @Get('reverse-geocode')
  reverseGeocode(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.locationsService.reverseGeocode(Number(lat), Number(lng));
  }
}
