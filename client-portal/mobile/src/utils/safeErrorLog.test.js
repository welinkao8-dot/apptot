import { toSafeErrorLog } from './safeErrorLog';

describe('toSafeErrorLog', () => {
  it('keeps request diagnostics without exposing Axios credentials or query values', () => {
    const error = {
      name: 'AxiosError',
      message: 'Request failed with status code 500',
      code: 'ERR_BAD_RESPONSE',
      config: {
        method: 'get',
        url: 'http://localhost:3001/trips/history/4fba363a-4d87-4409-88e5-ca9f9e5f36e9?token=secret',
        headers: { Authorization: 'Bearer private-token' },
      },
      response: { status: 500, data: { message: 'private response body' } },
    };

    const safe = toSafeErrorLog(error);

    expect(safe).toEqual({
      name: 'AxiosError',
      message: 'HTTP 500',
      code: 'ERR_BAD_RESPONSE',
      method: 'GET',
      endpoint: '/trips/history/:id',
      status: 500,
    });
    expect(JSON.stringify(safe)).not.toMatch(/private-token|secret|private response body|4fba363a/i);
  });

  it('returns a safe summary for non-request errors', () => {
    expect(toSafeErrorLog(new Error('unexpected'))).toEqual({
      name: 'Error',
      message: 'unexpected',
    });
  });
});
