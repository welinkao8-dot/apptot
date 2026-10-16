import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class DriverPushTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token: string;

  @IsIn(['android', 'ios'])
  platform: 'android' | 'ios';
}

export class RemoveDriverPushTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token: string;
}
