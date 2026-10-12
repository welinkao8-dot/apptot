import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DriverApiService } from './driver-api.service';
import { RidesGateway } from './rides/rides.gateway';
import { JwtAuthGuard, Roles, RolesGuard } from '@app/auth';

@Controller()
export class DriverApiController {
  constructor(
    private readonly driverApiService: DriverApiService,
    private readonly ridesGateway: RidesGateway
  ) { }

  @Get()
  getHello(): string {
    return this.driverApiService.getHello();
  }

  @Post('notify-driver-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  notifyDriverStatus(@Body() body: { driverId: string, status: 'suspended' | 'active' }) {
    this.ridesGateway.notifyDriverAccountStatus(body.driverId, body.status);
    return { success: true };
  }
}
