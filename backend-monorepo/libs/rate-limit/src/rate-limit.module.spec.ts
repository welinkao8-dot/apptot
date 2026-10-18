import { getRateLimitOptions, getTrustedProxyHops } from './rate-limit.module';

describe('API rate limit configuration', () => {
  it('defaults to 120 requests per 60 seconds', () => {
    expect(getRateLimitOptions({})).toMatchObject([{ limit: 120, ttl: 60_000, blockDuration: 60_000 }]);
  });

  it('uses configured positive integer limits and windows', () => {
    expect(getRateLimitOptions({ API_RATE_LIMIT_LIMIT: '30', API_RATE_LIMIT_TTL_MS: '15000' }))
      .toMatchObject([{ limit: 30, ttl: 15_000, blockDuration: 15_000 }]);
  });

  it('tracks requests by the client IP after trusted proxy configuration is applied', () => {
    const options = getRateLimitOptions({}) as Array<{ getTracker: (request: Record<string, unknown>) => string }>;
    expect(options[0].getTracker({ ip: '203.0.113.7', user: { sub: 'admin-1' }, socket: { remoteAddress: '127.0.0.1' } }))
      .toBe('203.0.113.7');
  });

  it('rejects invalid rate limit configuration instead of silently disabling protection', () => {
    expect(() => getRateLimitOptions({ API_RATE_LIMIT_LIMIT: '0' })).toThrow('API_RATE_LIMIT_LIMIT must be a positive integer.');
  });

  it('defaults to no trusted proxies and validates an explicit proxy hop count', () => {
    expect(getTrustedProxyHops({})).toBe(0);
    expect(getTrustedProxyHops({ TRUST_PROXY_HOPS: '1' })).toBe(1);
    expect(() => getTrustedProxyHops({ TRUST_PROXY_HOPS: '-1' })).toThrow('TRUST_PROXY_HOPS must be a non-negative integer.');
  });
});
