import { Body, Controller, Delete, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/auth';
import type { AuthUser } from '@app/auth';
import { DriverPushService } from './driver-push.service';
import { DriverPushTokenDto, RemoveDriverPushTokenDto } from './driver-push.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('driver')
export class DriverPushController {
  constructor(private readonly pushService: DriverPushService) {}

  @Post('push-token')
  registerToken(
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) body: DriverPushTokenDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pushService.registerToken(user.sub, body.token, body.platform);
  }

  @Delete('push-token')
  removeToken(
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) body: RemoveDriverPushTokenDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pushService.unregisterToken(user.sub, body.token);
  }
}
