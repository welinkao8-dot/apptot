import { createHash, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';

export function requireInternalServiceToken(config: ConfigService): string {
  const token = config.get<unknown>('INTERNAL_SERVICE_TOKEN');
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('INTERNAL_SERVICE_TOKEN must be configured with a non-blank value');
  }
  return token.trim();
}

export function matchesInternalServiceToken(expected: string, received: unknown): boolean {
  if (typeof received !== 'string') return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(expected), digest(received));
}
