import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

export class ToggleDriverAvailabilityDto {
  @IsBoolean()
  isOnline: boolean;
}

export class TripIdSocketDto {
  @IsUUID()
  tripId: string;
}

export class FinishTripSocketDto extends TripIdSocketDto {
  @IsOptional()
  @IsString()
  @Length(1, 24)
  finalFare?: string;
}

export class ConfirmCashPaymentSocketDto extends TripIdSocketDto {
  @Transform(({ value }) => typeof value === 'number' ? String(value) : value)
  @IsString()
  @Length(1, 11)
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  amount: string;
}

export class TripProgressCoordinatesDto {
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  lng: number;
}

export class TripProgressSocketDto extends TripIdSocketDto {
  @ValidateNested()
  @Type(() => TripProgressCoordinatesDto)
  coords: TripProgressCoordinatesDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  timestamp?: number;
}
