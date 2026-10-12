import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from './auth-user';
import { requireJwtSecret } from './jwt-config';

// Validate claim shape only; callers consuming a token must verify its signature first.
export function validateJwtClaims(payload: unknown): AuthUser {
  if (!payload || typeof payload !== 'object') {
    throw new UnauthorizedException('Invalid token claims');
  }
  const { sub, role } = payload as Record<string, unknown>;
  if (
    typeof sub !== 'string' ||
    !sub.trim() ||
    (role !== 'admin' && role !== 'client' && role !== 'driver')
  ) {
    throw new UnauthorizedException('Invalid token claims');
  }
  return { sub, role };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(config),
      algorithms: ['HS256'],
    });
  }

  validate(payload: unknown): AuthUser {
    return validateJwtClaims(payload);
  }
}
