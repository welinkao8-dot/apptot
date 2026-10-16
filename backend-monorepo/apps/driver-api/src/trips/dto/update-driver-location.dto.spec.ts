import { ValidationPipe } from '@nestjs/common';
import { UpdateDriverLocationDto } from './update-driver-location.dto';

describe('UpdateDriverLocationDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('accepts valid coordinates and optional GPS metadata', async () => {
    const result = await pipe.transform(
      { lat: -8.84, lng: 13.29, accuracy: 8, timestamp: Date.now(), heading: 90 },
      { type: 'body', metatype: UpdateDriverLocationDto },
    );

    expect(result).toEqual(expect.objectContaining({ lat: -8.84, lng: 13.29, accuracy: 8, heading: 90 }));
  });

  it.each([
    { lat: 91, lng: 13.29 },
    { lat: -8.84, lng: 181 },
    { lat: -8.84, lng: 13.29, accuracy: 101 },
    { lat: -8.84, lng: 13.29, heading: 360 },
    { lat: -8.84, lng: 13.29, timestamp: 'yesterday' },
    { lat: -8.84, lng: 13.29, driverId: 'someone-else' },
  ])('rejects malformed or untrusted location data: %o', async (body) => {
    await expect(pipe.transform(body, { type: 'body', metatype: UpdateDriverLocationDto })).rejects.toThrow();
  });
});
