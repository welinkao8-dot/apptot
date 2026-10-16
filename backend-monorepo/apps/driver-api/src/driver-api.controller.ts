import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DriverApiService } from './driver-api.service';
import { RidesGateway } from './rides/rides.gateway';
import { InternalServiceTokenGuard } from '@app/auth';
import { NotifyDriverStatusDto } from './driver-api.dto';

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
  @UseGuards(InternalServiceTokenGuard)
  notifyDriverStatus(@Body() body: NotifyDriverStatusDto) {
    this.ridesGateway.notifyDriverAccountStatus(body.driverId, body.status);
    return { success: true };
  }
}
