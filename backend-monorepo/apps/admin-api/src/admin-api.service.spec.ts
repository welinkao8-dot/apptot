import axios from 'axios';
import { AdminApiService } from './admin-api.service';

jest.mock('axios', () => ({ post: jest.fn() }));

describe('AdminApiService', () => {
  it('forwards the authenticated admin authorization when notifying the driver API', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();
    const prisma = {
      drivers: { update: jest.fn().mockResolvedValue({}) },
      profiles: { update: jest.fn().mockResolvedValue({}) },
      audit_logs: { create: jest.fn().mockResolvedValue({}) },
    };
    const adminGateway = { sendToAdmins: jest.fn() };
    jest.mocked(axios.post).mockResolvedValue({ data: { success: true } });
    const service = new AdminApiService(prisma as never, adminGateway as never);

    await service.updateDriverStatus('driver-a', 'active', 'Bearer verified-admin-token');

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:3004/notify-driver-status',
      { driverId: 'driver-a', status: 'active' },
      { headers: { Authorization: 'Bearer verified-admin-token' } },
    );
    log.mockRestore();
  });
});
