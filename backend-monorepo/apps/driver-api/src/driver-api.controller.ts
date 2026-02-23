import { Controller, Get, Post, Body } from '@nestjs/common';
import { DriverApiService } from './driver-api.service';
import { RidesGateway } from './rides/rides.gateway';

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
  notifyDriverStatus(@Body() body: { driverId: string, status: 'suspended' | 'active' }) {
    console.log(`📨 Received notify-driver-status request:`, body);
    this.ridesGateway.notifyDriverAccountStatus(body.driverId, body.status);
    console.log(`📤 Called RidesGateway.notifyDriverAccountStatus for driver ${body.driverId}`);
    return { success: true };
  }
}
