import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';

const DEFAULT_LIMIT = 120;
const DEFAULT_TTL_MS = 60_000;

function readPositiveInteger(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

export function getRateLimitOptions(env: NodeJS.ProcessEnv = process.env): ThrottlerModuleOptions {
  const ttl = readPositiveInteger('API_RATE_LIMIT_TTL_MS', DEFAULT_TTL_MS, env);
  const limit = readPositiveInteger('API_RATE_LIMIT_LIMIT', DEFAULT_LIMIT, env);

  return [{
    name: 'default',
    ttl,
    limit,
    blockDuration: ttl,
    setHeaders: true,
    skipIf: context => context.getType() !== 'http',
    getTracker: request => request.ip ?? request.socket?.remoteAddress ?? 'unknown',
  }];
}

export function getTrustedProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRUST_PROXY_HOPS;
  if (raw === undefined || raw === '') return 0;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
  }
  return value;
}

@Module({
  imports: [ThrottlerModule.forRootAsync({ useFactory: () => getRateLimitOptions() })],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ApiRateLimitModule { }
