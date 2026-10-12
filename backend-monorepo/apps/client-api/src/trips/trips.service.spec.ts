import { ForbiddenException } from '@nestjs/common';
import { TripsService } from './trips.service';

describe('TripsService', () => {
  it('rejects cancellation when the persisted trip belongs to another client', async () => {
    const prisma = {
      trips: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new TripsService(prisma as never);

    await expect(service.cancel('trip-b', 'client-a')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
