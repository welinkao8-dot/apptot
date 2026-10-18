import axios from 'axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { HereRoutingProvider } from './here-routing.provider';

jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
}));

describe('HereRoutingProvider', () => {
  const originalKey = process.env.HERE_ROUTING_API_KEY;
  const provider = new HereRoutingProvider();

  afterEach(() => {
    jest.resetAllMocks();
    if (originalKey === undefined) delete process.env.HERE_ROUTING_API_KEY;
    else process.env.HERE_ROUTING_API_KEY = originalKey;
  });

  it('returns route metrics from the HERE route summary', async () => {
    process.env.HERE_ROUTING_API_KEY = 'test-routing-key';
    jest.mocked(axios.get).mockResolvedValue({ data: { routes: [{ sections: [{ summary: { length: 5400, duration: 720 }, polyline: 'encoded-route' }] }] } } as never);

    await expect(provider.getRoute({ originLat: 1, originLng: 2, destLat: 3, destLng: 4 }))
      .resolves.toEqual({ distanceMeters: 5400, durationSeconds: 720, polyline: 'encoded-route' });
    expect(axios.get).toHaveBeenCalledWith('https://router.hereapi.com/v8/routes', expect.objectContaining({
      params: expect.objectContaining({ origin: '1,2', destination: '3,4', return: 'polyline,summary' }),
      timeout: 8000,
    }));
  });

  it('fails closed when HERE omits route geometry required by the customer map', async () => {
    process.env.HERE_ROUTING_API_KEY = 'test-routing-key';
    jest.mocked(axios.get).mockResolvedValue({ data: { routes: [{ sections: [{ summary: { length: 5400, duration: 720 } }] }] } } as never);

    await expect(provider.getRoute({ originLat: 1, originLng: 2, destLat: 3, destLng: 4 }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uses the transport mode configured for the service', async () => {
    process.env.HERE_ROUTING_API_KEY = 'test-routing-key';
    jest.mocked(axios.get).mockResolvedValue({ data: { routes: [{ sections: [{ summary: { length: 5400, duration: 720 }, polyline: 'encoded-route' }] }] } } as never);

    await provider.getRoute({ originLat: 1, originLng: 2, destLat: 3, destLng: 4 }, 'scooter');

    expect(axios.get).toHaveBeenCalledWith('https://router.hereapi.com/v8/routes', expect.objectContaining({
      params: expect.objectContaining({ transportMode: 'scooter' }),
    }));
  });

  it('retries once after a transient DNS resolution failure', async () => {
    process.env.HERE_ROUTING_API_KEY = 'test-routing-key';
    jest.mocked(axios.get)
      .mockRejectedValueOnce(Object.assign(new Error('temporary DNS failure'), { isAxiosError: true, code: 'EAI_AGAIN' }))
      .mockResolvedValueOnce({ data: { routes: [{ sections: [{ summary: { length: 5400, duration: 720 }, polyline: 'encoded-route' }] }] } } as never);

    await expect(provider.getRoute({ originLat: 1, originLng: 2, destLat: 3, destLng: 4 }))
      .resolves.toEqual({ distanceMeters: 5400, durationSeconds: 720, polyline: 'encoded-route' });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it.each([400, 503])('does not retry an HTTP %i HERE response', async (status) => {
    process.env.HERE_ROUTING_API_KEY = 'test-routing-key';
    jest.mocked(axios.get).mockRejectedValue(Object.assign(new Error('HERE request failed'), {
      isAxiosError: true,
      response: { status },
    }));

    await expect(provider.getRoute({ originLat: 1, originLng: 2, destLat: 3, destLng: 4 }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('retries a transient HERE timeout once and then returns the route', async () => {
    process.env.HERE_ROUTING_API_KEY = 'test-routing-key';
    jest.mocked(axios.get)
      .mockRejectedValueOnce(Object.assign(new Error('route timeout'), { isAxiosError: true, code: 'ETIMEDOUT' }))
      .mockResolvedValueOnce({ data: { routes: [{ sections: [{ summary: { length: 5400, duration: 720 }, polyline: 'encoded-route' }] }] } } as never);

    await expect(provider.getRoute({ originLat: 1, originLng: 2, destLat: 3, destLng: 4 }))
      .resolves.toMatchObject({ distanceMeters: 5400, durationSeconds: 720 });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the server routing key is missing', async () => {
    delete process.env.HERE_ROUTING_API_KEY;
    await expect(provider.getRoute({ originLat: 1, originLng: 2, destLat: 3, destLng: 4 }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('rejects an empty or malformed HERE route response', async () => {
    process.env.HERE_ROUTING_API_KEY = 'test-routing-key';
    jest.mocked(axios.get).mockResolvedValue({ data: { routes: [] } } as never);
    await expect(provider.getRoute({ originLat: 1, originLng: 2, destLat: 3, destLng: 4 }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each([
    { summary: { length: Number.NaN, duration: 720 }, polyline: 'route' },
    { summary: { length: 5400, duration: -1 }, polyline: 'route' },
    { summary: { length: 5400, duration: 720 }, polyline: '' },
  ])('rejects invalid HERE metrics or empty geometry: %p', async (section) => {
    process.env.HERE_ROUTING_API_KEY = 'test-routing-key';
    jest.mocked(axios.get).mockResolvedValue({ data: { routes: [{ sections: [section] }] } } as never);

    await expect(provider.getRoute({ originLat: 1, originLng: 2, destLat: 3, destLng: 4 }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
