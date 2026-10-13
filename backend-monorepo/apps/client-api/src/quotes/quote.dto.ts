import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateQuoteDto {
  @IsIn(['ride', 'delivery'])
  category: 'ride' | 'delivery';

  @IsString()
  @IsNotEmpty()
  originAddress: string;

  @IsString()
  @IsNotEmpty()
  destAddress: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  destLat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  destLng: number;

  @IsOptional()
  @IsObject()
  deliveryInfo?: Record<string, unknown>;
}
