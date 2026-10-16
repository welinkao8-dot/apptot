import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const DRIVER_ADMIN_STATUSES = ['active', 'approved', 'rejected', 'suspended'] as const;
export const CLIENT_ADMIN_STATUSES = ['active', 'suspended'] as const;

export class DriverStatusDto {
  @IsIn(DRIVER_ADMIN_STATUSES)
  status!: (typeof DRIVER_ADMIN_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminStatusDto {
  @IsIn(CLIENT_ADMIN_STATUSES)
  status!: (typeof CLIENT_ADMIN_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DriverToggleStatusDto {
  @IsIn(['activate', 'deactivate'])
  action!: 'activate' | 'deactivate';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DriverVehicleCategoryDto {
  @IsIn(['car', 'moto', 'truck'])
  vehicle_category!: 'car' | 'moto' | 'truck';
}
