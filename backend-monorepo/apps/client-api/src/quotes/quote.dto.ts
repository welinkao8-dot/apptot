import { Transform, Type } from 'class-transformer';
import { IsDefined, IsIn, IsNumber, IsString, Length, Matches, Max, Min, ValidateIf, ValidateNested } from 'class-validator';

const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class DeliveryInfoDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 150)
  recipientName!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value)
  @IsString()
  @Matches(/^(?:\+244)?9\d{8}$/)
  recipientPhone!: string;

  @Transform(trimString)
  @IsString()
  @Length(1, 500)
  packageDescription!: string;
}

export class CreateQuoteDto {
  @IsIn(['ride', 'delivery'])
  category: 'ride' | 'delivery';

  @Transform(trimString)
  @IsString()
  @Length(1, 300)
  originAddress: string;

  @Transform(trimString)
  @IsString()
  @Length(1, 300)
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

  @ValidateIf((quote: CreateQuoteDto) => quote.category === 'delivery')
  @IsDefined()
  @ValidateNested()
  @Type(() => DeliveryInfoDto)
  deliveryInfo?: DeliveryInfoDto;
}
