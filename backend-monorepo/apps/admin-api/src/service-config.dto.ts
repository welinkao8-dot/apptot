import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const DECIMAL_10_2_MAX = 99_999_999.99;
const ROUTING_MODES = ['car', 'scooter', 'truck'] as const;
const SERVICE_CATEGORIES = ['ride', 'delivery'] as const;
const PLATFORM_FEE_TYPES = ['percentage', 'fixed'] as const;

export class CreateServiceConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsIn(SERVICE_CATEGORIES)
  category!: (typeof SERVICE_CATEGORIES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  service_type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vehicle_category!: string;

  @IsIn(ROUTING_MODES)
  routing_mode!: (typeof ROUTING_MODES)[number];

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  image_url?: string | null;

  @IsMoney()
  base_fare!: number;

  @IsMoney()
  price_per_km!: number;

  @IsMoney()
  price_per_min!: number;

  @IsMoney()
  min_fare!: number;

  @IsIn(PLATFORM_FEE_TYPES)
  platform_fee_type!: (typeof PLATFORM_FEE_TYPES)[number];

  @IsMoney()
  platform_fee_value!: number;
}

export class UpdateServiceConfigDto extends PartialType(CreateServiceConfigDto) {}

function IsMoney(): PropertyDecorator {
  return (target, propertyKey) => {
    IsNumber({ maxDecimalPlaces: 2 })(target, propertyKey as string);
    Min(0)(target, propertyKey as string);
    Max(DECIMAL_10_2_MAX)(target, propertyKey as string);
  };
}
