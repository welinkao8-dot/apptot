import axios from 'axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { LocationsService } from './locations.service';

jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
}));

describe('LocationsService', () => {
  const originalKey = process.env.HERE_API_KEY;
  const originalMapKey = process.env.HERE_MAP_API_KEY;
  const originalRoutingKey = process.env.HERE_ROUTING_API_KEY;
  const service = new LocationsService();

  afterEach(() => {
    jest.resetAllMocks();
    if (originalKey === undefined) delete process.env.HERE_API_KEY;
    else process.env.HERE_API_KEY = originalKey;
    if (originalMapKey === undefined) delete process.env.HERE_MAP_API_KEY;
    else process.env.HERE_MAP_API_KEY = originalMapKey;
    if (originalRoutingKey === undefined) delete process.env.HERE_ROUTING_API_KEY;
    else process.env.HERE_ROUTING_API_KEY = originalRoutingKey;
  });

  it('never returns the private routing key as mobile map configuration', () => {
    delete process.env.HERE_MAP_API_KEY;
    delete process.env.HERE_API_KEY;
    process.env.HERE_ROUTING_API_KEY = 'private-routing-key';

    expect(() => service.mapConfig()).toThrow(ServiceUnavailableException);
  });

  it('returns only the dedicated public map key when server keys are also configured', () => {
    process.env.HERE_API_KEY = 'server-geocoding-key';
    process.env.HERE_MAP_API_KEY = 'restricted-map-key';
    process.env.HERE_ROUTING_API_KEY = 'private-routing-key';

    expect(service.mapConfig()).toEqual({ apiKey: 'restricted-map-key' });
  });

  it('proxies autosuggest using the server key and returns only address fields', async () => {
    process.env.HERE_API_KEY = 'server-only-key';
    jest.mocked(axios.get).mockResolvedValue({ data: { items: [{ id: 'id-1', title: 'Talatona', address: { label: 'Talatona' }, position: { lat: -8.9, lng: 13.2 }, access: [{}] }] } } as never);

    await expect(service.autosuggest(' Talatona ', -8.9, 13.2)).resolves.toEqual([
      { id: 'id-1', title: 'Talatona', address: { label: 'Talatona' }, position: { lat: -8.9, lng: 13.2 } },
    ]);
    expect(axios.get).toHaveBeenCalledWith('https://geocode.search.hereapi.com/v1/autosuggest', expect.objectContaining({
      params: expect.objectContaining({ q: 'Talatona', apiKey: 'server-only-key', at: '-8.9,13.2', in: 'countryCode:AGO' }),
      timeout: 8000,
    }));
  });

  it('uses a Luanda bias and avoids a HERE request for short searches', async () => {
    process.env.HERE_ROUTING_API_KEY = 'routing-server-key';
    await expect(service.autosuggest('  Ab ')).resolves.toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();

    jest.mocked(axios.get).mockResolvedValue({ data: { items: [] } } as never);
    await service.autosuggest('Abc');
    expect(jest.mocked(axios.get).mock.calls[0][1]?.params).toEqual(expect.objectContaining({ apiKey: 'routing-server-key', at: '-8.839,13.289' }));
  });

  it('retries one transient geocoding timeout', async () => {
    process.env.HERE_API_KEY = 'server-only-key';
    jest.mocked(axios.get)
      .mockRejectedValueOnce(Object.assign(new Error('temporary timeout'), { isAxiosError: true, code: 'ECONNABORTED' }))
      .mockResolvedValueOnce({ data: { items: [] } } as never);

    await expect(service.autosuggest('Talatona')).resolves.toEqual([]);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('returns a reverse-geocoded label and rejects invalid coordinates', async () => {
    process.env.HERE_API_KEY = 'server-only-key';
    jest.mocked(axios.get).mockResolvedValue({ data: { items: [{ address: { label: 'Talatona, Luanda' } }] } } as never);
    await expect(service.reverseGeocode(-8.9, 13.2)).resolves.toBe('Talatona, Luanda');
    await expect(service.reverseGeocode(91, 13.2)).resolves.toBeNull();
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('fails closed when no server-side HERE key exists', async () => {
    delete process.env.HERE_API_KEY;
    delete process.env.HERE_ROUTING_API_KEY;
    await expect(service.autosuggest('Talatona')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(axios.get).not.toHaveBeenCalled();
  });
});
