import { IsIn, IsString, IsUUID } from 'class-validator';

export class NotifyDriverStatusDto {
  @IsUUID()
  driverId!: string;

  @IsString()
  @IsIn(['suspended', 'active'])
  status!: 'suspended' | 'active';
}
