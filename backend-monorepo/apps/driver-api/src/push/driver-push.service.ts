import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { DRIVER_PUSH_MESSAGING } from './driver-push.constants';

export type DriverPushPlatform = 'android' | 'ios';

export type DriverPushMessage = {
  tokens: string[];
  notification: { title: string; body: string };
  data: { type: 'trip_offer'; tripId: string };
  android: { priority: 'high'; ttl: number; notification: { channelId: string } };
};

export interface DriverPushMessaging {
  sendEachForMulticast(message: DriverPushMessage): Promise<{
    responses: Array<{ success: boolean; error?: { code?: string } }>;
  }>;
}

type DriverFcmTokenStore = {
  findUnique(args: { where: { token: string } }): Promise<{ driver_id: string } | null>;
  create(args: { data: { driver_id: string; token: string; platform: DriverPushPlatform } }): Promise<unknown>;
  update(args: { where: { token: string }; data: { platform: DriverPushPlatform; updated_at: Date } }): Promise<unknown>;
  deleteMany(args: { where: { driver_id: string; token: string | { in: string[] } } }): Promise<unknown>;
  findMany(args: { where: { driver_id: string }; select: { token: true } }): Promise<Array<{ token: string }>>;
};

@Injectable()
export class DriverPushService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DRIVER_PUSH_MESSAGING)
    private readonly messaging: DriverPushMessaging | null,
  ) {}

  private get tokenStore(): DriverFcmTokenStore {
    return (this.prisma as unknown as { driver_fcm_tokens: DriverFcmTokenStore }).driver_fcm_tokens;
  }

  async registerToken(driverId: string, token: string, platform: DriverPushPlatform) {
    const current = await this.tokenStore.findUnique({ where: { token } });
    if (current && current.driver_id !== driverId) {
      throw new ConflictException('Este dispositivo já está associado a outra conta.');
    }

    if (current) {
      await this.tokenStore.update({
        where: { token },
        data: { platform, updated_at: new Date() },
      });
    } else {
      await this.tokenStore.create({ data: { driver_id: driverId, token, platform } });
    }

    return { success: true };
  }

  async unregisterToken(driverId: string, token: string) {
    await this.tokenStore.deleteMany({ where: { driver_id: driverId, token } });
    return { success: true };
  }

  async sendTripOffer(driverId: string, tripId: string) {
    if (!this.messaging) return { sent: 0, skipped: true };

    const devices = await this.tokenStore.findMany({
      where: { driver_id: driverId },
      select: { token: true },
    });
    if (devices.length === 0) return { sent: 0 };

    const tokens = devices.map(({ token }) => token);
    const result = await this.messaging.sendEachForMulticast({
      tokens,
      notification: { title: 'Nova solicitação', body: 'Abre a TOT para ver os detalhes.' },
      data: { type: 'trip_offer', tripId },
      android: {
        priority: 'high',
        ttl: 15_000,
        notification: { channelId: 'trip_offers' },
      },
    });

    const invalidTokens = result.responses.flatMap((response, index) =>
      !response.success && [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
      ].includes(response.error?.code ?? '')
        ? [tokens[index]]
        : [],
    );
    if (invalidTokens.length > 0) {
      await this.tokenStore.deleteMany({
        where: { driver_id: driverId, token: { in: invalidTokens } },
      });
    }

    return { sent: result.responses.filter((response) => response.success).length };
  }
}
