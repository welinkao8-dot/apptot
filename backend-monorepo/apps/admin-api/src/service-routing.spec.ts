import { BadRequestException } from '@nestjs/common';
import { assertCompatibleServiceRouting, requiredRoutingModeForVehicleCategory } from './service-routing';

describe('service vehicle routing compatibility', () => {
  it.each([
    ['moto', 'scooter'],
    ['Motorcycle', 'scooter'],
    ['Comfort Carro', 'car'],
    ['Camião', 'truck'],
    ['Van', 'truck'],
  ])('maps category %s to route mode %s', (category, expected) => {
    expect(requiredRoutingModeForVehicleCategory(category)).toBe(expected);
  });

  it('allows custom vehicle labels with a valid configured route mode', () => {
    expect(() => assertCompatibleServiceRouting('Comfort', 'car')).not.toThrow();
  });

  it('rejects a route mode that conflicts with a recognizable vehicle category', () => {
    expect(() => assertCompatibleServiceRouting('moto', 'car')).toThrow(BadRequestException);
  });
});
