import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';

@Injectable()
export class ClientApiService {
  constructor(private prisma: PrismaService) { }

  getHello(): string {
    return 'Hello World!';
  }

  async getAvailableServices() {
    return this.prisma.service_configs.findMany({
      orderBy: { id: 'asc' }
    });
  }
}
