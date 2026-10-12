import { ConfigService } from '@nestjs/config';

export function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<unknown>('JWT_SECRET');
  if (typeof secret !== 'string' || !secret.trim()) {
    throw new Error('JWT_SECRET must be configured with a non-blank value');
  }
  return secret;
}
