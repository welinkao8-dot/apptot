export const DRIVER_VEHICLE_CATEGORIES = [
  { value: 'moto', label: 'Motorizada' },
  { value: 'car', label: 'Carro' },
  { value: 'truck', label: 'Camião' },
];

export function isDriverVehicleCategory(value) {
  return DRIVER_VEHICLE_CATEGORIES.some(category => category.value === value);
}
