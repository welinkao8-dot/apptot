import { ConflictException } from '@nestjs/common';
import { DriverPushService } from './driver-push.service';

describe('DriverPushService', () => {
  it('registers a token for the authenticated driver', async () => {
    const prisma = {
      driver_fcm_tokens: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'token-row' }),
      },
    };
    const service = new DriverPushService(prisma as never, null);

    await expect(service.registerToken('driver-a', 'fcm-token-12345678901234567890', 'android'))
      .resolves.toEqual({ success: true });
    expect(prisma.driver_fcm_tokens.create).toHaveBeenCalledWith({
      data: { driver_id: 'driver-a', token: 'fcm-token-12345678901234567890', platform: 'android' },
    });
  });

  it('refreshes metadata when the same driver registers the same token again', async () => {
    const prisma = {
      driver_fcm_tokens: {
        findUnique: jest.fn().mockResolvedValue({ driver_id: 'driver-a' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new DriverPushService(prisma as never, null);

    await service.registerToken('driver-a', 'fcm-token-12345678901234567890', 'android');
    expect(prisma.driver_fcm_tokens.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { token: 'fcm-token-12345678901234567890' },
      data: expect.objectContaining({ platform: 'android', updated_at: expect.any(Date) }),
    }));
  });

  it('does not let another driver take ownership of an existing device token', async () => {
    const prisma = {
      driver_fcm_tokens: {
        findUnique: jest.fn().mockResolvedValue({ driver_id: 'driver-owner' }),
        create: jest.fn(),
      },
    };
    const service = new DriverPushService(prisma as never, null);

    await expect(service.registerToken('driver-attacker', 'fcm-token-12345678901234567890', 'android'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.driver_fcm_tokens.create).not.toHaveBeenCalled();
  });

  it('sends a privacy-safe offer notification only to that driver device', async () => {
    const token = 'fcm-token-12345678901234567890';
    const prisma = {
      driver_fcm_tokens: { findMany: jest.fn().mockResolvedValue([{ token }]) },
    };
    const messaging = { sendEachForMulticast: jest.fn().mockResolvedValue({ responses: [{ success: true }] }) };
    const service = new DriverPushService(prisma as never, messaging as never);

    await expect(service.sendTripOffer('driver-a', 'trip-a')).resolves.toEqual({ sent: 1 });
    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: [token],
      notification: { title: 'Nova solicitação', body: 'Abre a TOT para ver os detalhes.' },
      data: { type: 'trip_offer', tripId: 'trip-a' },
      android: { priority: 'high', ttl: 15_000, notification: { channelId: 'trip_offers' } },
    });
    expect(JSON.stringify(messaging.sendEachForMulticast.mock.calls[0][0])).not.toContain('pickupAddress');
  });

  it('skips delivery when FCM is not configured', async () => {
    const prisma = { driver_fcm_tokens: { findMany: jest.fn().mockResolvedValue([{ token: 'fcm-token' }]) } };
    const service = new DriverPushService(prisma as never, null);

    await expect(service.sendTripOffer('driver-a', 'trip-a')).resolves.toEqual({ sent: 0, skipped: true });
  });

  it('removes an invalid FCM token after the provider rejects it', async () => {
    const invalidToken = 'invalid-fcm-token-123456789012345';
    const prisma = {
      driver_fcm_tokens: {
        findMany: jest.fn().mockResolvedValue([{ token: invalidToken }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const messaging = {
      sendEachForMulticast: jest.fn().mockResolvedValue({
        responses: [{ success: false, error: { code: 'messaging/invalid-registration-token' } }],
      }),
    };
    const service = new DriverPushService(prisma as never, messaging as never);

    await service.sendTripOffer('driver-a', 'trip-a');

    expect(prisma.driver_fcm_tokens.deleteMany).toHaveBeenCalledWith({
      where: { driver_id: 'driver-a', token: { in: [invalidToken] } },
    });
  });
});
