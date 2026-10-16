import { validateSync } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { CreateServiceConfigDto, UpdateServiceConfigDto } from './service-config.dto';

const validConfig = {
  name: 'Moto',
  category: 'ride',
  service_type: 'express',
  vehicle_category: 'moto',
  routing_mode: 'scooter',
  description: '',
  image_url: '',
  base_fare: 500,
  price_per_km: 150.25,
  price_per_min: 10,
  min_fare: 700,
  platform_fee_type: 'percentage',
  platform_fee_value: 15,
};

describe('service config DTOs', () => {
  it('accepts the pricing form payload and DECIMAL(10,2) boundary', () => {
    const dto = Object.assign(new CreateServiceConfigDto(), {
      ...validConfig,
      base_fare: 99_999_999.99,
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it.each([-0.01, 100_000_000, 1.001, '500', Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid money value %p',
    value => {
      const dto = Object.assign(new CreateServiceConfigDto(), { ...validConfig, base_fare: value });
      expect(validateSync(dto).some(error => error.property === 'base_fare')).toBe(true);
    },
  );

  it.each([
    ['category', 'parcel'],
    ['routing_mode', 'spaceship'],
    ['platform_fee_type', 'unknown'],
  ])('rejects invalid service contract field %s', (field, value) => {
    const dto = Object.assign(new CreateServiceConfigDto(), { ...validConfig, [field]: value });
    expect(validateSync(dto).some(error => error.property === field)).toBe(true);
  });

  it('accepts partial updates while validating fields that are present', () => {
    expect(validateSync(Object.assign(new UpdateServiceConfigDto(), { price_per_km: 0.25 }))).toHaveLength(0);
    const invalid = Object.assign(new UpdateServiceConfigDto(), { category: 'food' });
    expect(validateSync(invalid).some(error => error.property === 'category')).toBe(true);
  });

  it('strips persisted metadata sent back by the existing edit form', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const dto = await pipe.transform(
      { price_per_km: 1.25, id: 7, updated_at: '2026-10-15T12:00:00.000Z' },
      { type: 'body', metatype: UpdateServiceConfigDto },
    );

    expect(dto).toEqual(Object.assign(new UpdateServiceConfigDto(), { price_per_km: 1.25 }));
  });
});
