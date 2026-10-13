import axios from 'axios';
import { AdminApiService } from './admin-api.service';

jest.mock('axios', () => ({ post: jest.fn() }));

describe('AdminApiService', () => {
  it('uses the configured internal service token when notifying the driver API', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();
    const prisma = {
      drivers: { update: jest.fn().mockResolvedValue({}) },
      profiles: { update: jest.fn().mockResolvedValue({}) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    };
    const adminGateway = { sendToAdmins: jest.fn() };
    jest.mocked(axios.post).mockResolvedValue({ data: { success: true } });
    const config = { get: jest.fn().mockReturnValue('service-token') };
    const service = new AdminApiService(prisma as never, adminGateway as never, config as never);

    await service.updateDriverStatus('driver-a', 'active');

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:3004/notify-driver-status',
      { driverId: 'driver-a', status: 'active' },
      { headers: { 'x-internal-service-token': 'service-token' } },
    );
    log.mockRestore();
  });

  it('rejects a status change when the internal service token is missing', async () => {
    const prisma = {
      drivers: { update: jest.fn().mockResolvedValue({}) },
      profiles: { update: jest.fn().mockResolvedValue({}) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new AdminApiService(
      prisma as never,
      { sendToAdmins: jest.fn() } as never,
      { get: jest.fn().mockReturnValue('') } as never,
    );

    await expect(service.updateDriverStatus('driver-a', 'active'))
      .rejects.toThrow('INTERNAL_SERVICE_TOKEN');

    expect(prisma.drivers.update).not.toHaveBeenCalled();
  });
});
