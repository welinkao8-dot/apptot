import { ForbiddenException } from '@nestjs/common';
import { TripsService } from './trips.service';

describe('TripsService driver availability', () => {
  it('does not allow suspended drivers to go online', async () => {
    const prisma = {
      drivers: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new TripsService(prisma as never);

    await expect(service.updateDriverStatus('driver-a', true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.drivers.updateMany).toHaveBeenCalledWith({
      where: { id: 'driver-a', status: 'active' },
      data: { is_online: true },
    });
  });

  it('allows active drivers to change availability', async () => {
    const prisma = {
      drivers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new TripsService(prisma as never);

    await expect(service.updateDriverStatus('driver-a', true)).resolves.toEqual({ count: 1 });
  });
});
