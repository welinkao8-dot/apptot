import { BadRequestException } from '@nestjs/common';

export function requiredRoutingModeForVehicleCategory(category: unknown): 'car' | 'scooter' | 'truck' | null {
  if (typeof category !== 'string') return null;
  if (/moto|motorcycle|scooter|bike/i.test(category)) return 'scooter';
  if (/truck|caminh|camião|camiao|van/i.test(category)) return 'truck';
  if (/car|autom[oó]vel/i.test(category)) return 'car';
  return null;
}

export function assertCompatibleServiceRouting(category: unknown, routingMode: unknown): void {
  const requiredMode = requiredRoutingModeForVehicleCategory(category);
  if (requiredMode && requiredMode !== routingMode) {
    throw new BadRequestException(`Modo de rota incompatível com a categoria de veículo (${requiredMode}).`);
  }
}
