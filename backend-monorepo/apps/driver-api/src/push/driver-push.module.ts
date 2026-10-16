import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '@app/database';
import { DRIVER_PUSH_MESSAGING } from './driver-push.constants';
import { DriverPushController } from './driver-push.controller';
import { DriverPushMessaging, DriverPushService } from './driver-push.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DriverPushController],
  providers: [
    {
      provide: DRIVER_PUSH_MESSAGING,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const serviceAccountJson = config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
        if (!serviceAccountJson?.trim()) return null;

        const serviceAccount = JSON.parse(serviceAccountJson);
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
          throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing required service account fields.');
        }

        const appName = 'tot-driver-push';
        const app = getApps().find((candidate) => candidate.name === appName)
          ?? initializeApp({ credential: cert(serviceAccount) }, appName);
        return getMessaging(app) as unknown as DriverPushMessaging;
      },
    },
    DriverPushService,
  ],
  exports: [DriverPushService],
})
export class DriverPushModule {}
