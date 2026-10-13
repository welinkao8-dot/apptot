import { ConfigService } from '@nestjs/config';
import { matchesInternalServiceToken, requireInternalServiceToken } from './internal-service-token';

describe('internal service token', () => {
  it('requires a configured, non-blank token', () => {
    const config = { get: jest.fn().mockReturnValue('   ') } as unknown as ConfigService;
    expect(() => requireInternalServiceToken(config)).toThrow('INTERNAL_SERVICE_TOKEN');
  });

  it('compares service tokens without accepting non-string headers', () => {
    expect(matchesInternalServiceToken('expected-token', 'expected-token')).toBe(true);
    expect(matchesInternalServiceToken('expected-token', 'wrong-token')).toBe(false);
    expect(matchesInternalServiceToken('expected-token', ['expected-token'])).toBe(false);
  });
});
