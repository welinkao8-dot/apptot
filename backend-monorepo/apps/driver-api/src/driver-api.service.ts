import { Injectable } from '@nestjs/common';

@Injectable()
export class DriverApiService {
  getHello(): string {
    return 'Hello World!';
  }
}
