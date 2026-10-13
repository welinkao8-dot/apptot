import { IsUUID } from 'class-validator';

export class CreateTripDto {
  @IsUUID()
  quoteId: string;
}
