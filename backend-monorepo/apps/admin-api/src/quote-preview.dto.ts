import { Type } from 'class-transformer';
import { IsDefined, IsNumber, Max, Min, ValidateNested } from 'class-validator';

const MAX_FARE = 99_999_999.99;

export class ProposedQuotePricingDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_FARE) base_fare!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_FARE) price_per_km!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_FARE) price_per_min!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_FARE) min_fare!: number;
}

export class QuotePreviewDto {
  @Type(() => Number) @IsNumber() @Min(-18.1) @Max(-4.3) originLat!: number;
  @Type(() => Number) @IsNumber() @Min(11.6) @Max(24.1) originLng!: number;
  @Type(() => Number) @IsNumber() @Min(-18.1) @Max(-4.3) destLat!: number;
  @Type(() => Number) @IsNumber() @Min(11.6) @Max(24.1) destLng!: number;
  @IsDefined() @ValidateNested() @Type(() => ProposedQuotePricingDto) proposed!: ProposedQuotePricingDto;
}
