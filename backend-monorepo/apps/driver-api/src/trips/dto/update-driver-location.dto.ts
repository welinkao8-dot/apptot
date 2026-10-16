import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min, ValidateBy } from 'class-validator';

export class UpdateDriverLocationDto {
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  accuracy?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  timestamp?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @ValidateBy({
    name: 'isHeadingBelow360',
    validator: { validate: (value: number) => value < 360 },
  })
  heading?: number;
}
