import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const trimOptionalEmail = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
};

export class CheckPhoneDto {
  @Transform(trimString)
  @IsString()
  @Length(6, 32)
  phone!: string;
}

export class LoginDto extends CheckPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class RegisterDto extends LoginDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 150)
  fullName!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  oldPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  newPassword!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 150)
  fullName?: string;

  @IsOptional()
  @Transform(trimOptionalEmail)
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
