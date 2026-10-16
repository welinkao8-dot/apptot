import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const trimOptional = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() || undefined : value;

export class DriverCheckPhoneDto {
  @Transform(trimString)
  @IsString()
  @Length(6, 32)
  phone!: string;
}

export class DriverLoginDto extends DriverCheckPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class DriverRegisterDto extends DriverLoginDto {
  @IsIn(['car', 'moto', 'truck'])
  vehicle_category!: 'car' | 'moto' | 'truck';

  @Transform(trimString)
  @IsString()
  @Length(1, 150)
  full_name!: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class DriverUpdateProfileDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 150)
  full_name?: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class DriverChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  newPassword!: string;
}

export class DriverUpdateDocsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\/(?:jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/i)
  @MaxLength(12 * 1024 * 1024)
  bi_frente!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\/(?:jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/i)
  @MaxLength(12 * 1024 * 1024)
  bi_verso!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\/(?:jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/i)
  @MaxLength(12 * 1024 * 1024)
  carta!: string;
}
