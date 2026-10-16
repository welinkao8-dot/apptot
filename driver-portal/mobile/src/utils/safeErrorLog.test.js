import { toSafeErrorLog } from './safeErrorLog';

describe('toSafeErrorLog', () => {
  it('removes query parameters, bearer headers, and identifiers from request errors', () => {
    const result = toSafeErrorLog({
      name: 'AxiosError',
      config: {
        url: 'https://api.example.test/trips/58c8a8de-8de8-4c4a-86d5-3bf5a1a3e159?apiKey=secret',
        method: 'get',
        headers: { Authorization: 'Bearer secret-token' },
      },
      response: { status: 500 },
    });

    expect(result).toEqual({
      name: 'AxiosError',
      message: 'HTTP 500',
      method: 'GET',
      endpoint: '/trips/:id',
      status: 500,
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('redacts bearer tokens from non-request messages', () => {
    expect(toSafeErrorLog(new Error('Authorization: Bearer abc.def.ghi'))).toEqual({
      name: 'Error',
      message: 'Authorization: Bearer [redacted]',
    });
  });
});
