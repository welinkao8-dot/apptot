import { IsIn, IsString, Length } from 'class-validator';

export class NotifyDriverStatusDto {
  @IsString()
  @Length(1, 64)
  driverId!: string;

  @IsString()
  @IsIn(['suspended', 'active'])
  status!: 'suspended' | 'active';
}
