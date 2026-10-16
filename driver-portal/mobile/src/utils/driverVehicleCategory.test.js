import { DRIVER_VEHICLE_CATEGORIES, isDriverVehicleCategory } from './driverVehicleCategory';

describe('driver vehicle category', () => {
  it('offers the canonical categories accepted by the API', () => {
    expect(DRIVER_VEHICLE_CATEGORIES.map(({ value }) => value)).toEqual(['moto', 'car', 'truck']);
    expect(DRIVER_VEHICLE_CATEGORIES.every(({ value }) => isDriverVehicleCategory(value))).toBe(true);
  });

  it('rejects absent and unsupported categories', () => {
    expect(isDriverVehicleCategory('')).toBe(false);
    expect(isDriverVehicleCategory('bicycle')).toBe(false);
  });
});
