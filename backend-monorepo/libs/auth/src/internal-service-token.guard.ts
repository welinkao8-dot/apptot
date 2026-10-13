import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { matchesInternalServiceToken, requireInternalServiceToken } from './internal-service-token';

@Injectable()
export class InternalServiceTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    return matchesInternalServiceToken(
      requireInternalServiceToken(this.config),
      request.headers['x-internal-service-token'],
    );
  }
}
