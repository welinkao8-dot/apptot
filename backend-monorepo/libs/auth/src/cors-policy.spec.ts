import { getCorsPolicy, isCorsOriginAllowed } from './cors-policy';

describe('getCorsPolicy', () => {
  it('exposes exact origin validation for cookie session endpoints', () => {
    expect(isCorsOriginAllowed('https://admin.example.com', {
      NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://admin.example.com,https://app.example.com',
    })).toBe(true);
    expect(isCorsOriginAllowed('https://evil.example.com', {
      NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://admin.example.com,https://app.example.com',
    })).toBe(false);
    expect(isCorsOriginAllowed(undefined, { NODE_ENV: 'development', ALLOWED_ORIGINS: '' })).toBe(false);
  });

  it('requires an explicit origin allowlist in production', () => {
    expect(() => getCorsPolicy({ NODE_ENV: 'production', ALLOWED_ORIGINS: '' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('rejects wildcard, malformed, and non-origin allowlist entries', () => {
    for (const allowedOrigins of ['*', 'https://example.com/path', 'not-a-url', 'https://user:pass@example.com']) {
      expect(() => getCorsPolicy({ NODE_ENV: 'production', ALLOWED_ORIGINS: allowedOrigins })).toThrow(/origem|ALLOWED_ORIGINS/i);
    }
  });

  it('allows exact configured origins and requests without Origin only', () => {
    const policy = getCorsPolicy({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://app.example.com,https://admin.example.com' });
    const check = policy.origin as (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => void;

    expect(check).toBeInstanceOf(Function);
    const results: Array<[string | undefined, boolean]> = [];
    for (const origin of ['https://app.example.com', 'https://admin.example.com', 'https://evil.example.com', undefined]) {
      check(origin, (_error, allowed) => results.push([origin, allowed === true]));
    }
    expect(results).toEqual([
      ['https://app.example.com', true],
      ['https://admin.example.com', true],
      ['https://evil.example.com', false],
      [undefined, true],
    ]);
    expect(policy.credentials).toBe(true);
  });

  it('uses an explicit localhost allowlist in development without reflecting arbitrary origins', () => {
    const policy = getCorsPolicy({ NODE_ENV: 'development', ALLOWED_ORIGINS: '' });
    const check = policy.origin as (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => void;
    const result: boolean[] = [];
    check('http://localhost:5173', (_error, allowed) => result.push(allowed === true));
    check('http://localhost:5175', (_error, allowed) => result.push(allowed === true));
    check('http://127.0.0.1:5175', (_error, allowed) => result.push(allowed === true));
    check('https://attacker.example', (_error, allowed) => result.push(allowed === true));
    expect(result).toEqual([true, true, true, false]);
  });
});
