import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AdminApiModule } from './admin-api.module';
import { ValidationPipe } from '@nestjs/common';
import { getCorsPolicy } from '@app/auth';
import { getTrustedProxyHops } from '../../../libs/rate-limit/src/rate-limit.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AdminApiModule);
  app.set('trust proxy', getTrustedProxyHops());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.enableCors(getCorsPolicy());

  // Serve static files from the uploads directory
  app.useStaticAssets(join(__dirname, '..', '..', '..', 'uploads'), {
    prefix: '/uploads/',
    setHeaders: response => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
      response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      response.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
