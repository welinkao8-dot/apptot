import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  ...jest.requireActual('bcrypt'),
  compare: jest.fn(),
}));

describe('AuthService driver registration', () => {
  it('persists the selected vehicle category for matching and dispatch', async () => {
    const profile = { id: 'driver-a', full_name: 'Ana', phone: '+244900000000', role: 'driver' };
    const upsert = jest.fn().mockResolvedValue({ ...profile, vehicle_category: 'moto' });
    const prisma = {
      profiles: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(callback => callback({
        profiles: { create: jest.fn().mockResolvedValue(profile) },
        drivers: { upsert },
      })),
      drivers: { findUnique: jest.fn().mockResolvedValue({ ...profile, vehicle_category: 'moto', status: 'pending_docs' }) },
    };
    const auth = new AuthService(prisma as never, { sign: jest.fn().mockReturnValue('token') } as never);

    await auth.register({ full_name: 'Ana', phone: '+244900000000', password: 'secret', vehicle_category: 'moto' });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ vehicle_category: 'moto' }),
      update: expect.objectContaining({ vehicle_category: 'moto' }),
    }));
  });
});

describe('AuthService login verification', () => {
  it('performs a password-hash comparison for unknown phone numbers', async () => {
    const prisma = { profiles: { findFirst: jest.fn().mockResolvedValue(null) } };
    const auth = new AuthService(prisma as never, { sign: jest.fn() } as never);
    const compare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
    compare.mockResolvedValue(false);

    await expect(auth.validateUser('+244900000000', 'wrong-password')).resolves.toBeNull();
    expect(compare).toHaveBeenCalledWith('wrong-password', expect.stringMatching(/^\$2[aby]\$/));
  });
});
