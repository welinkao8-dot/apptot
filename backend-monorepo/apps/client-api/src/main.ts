import { NestFactory } from '@nestjs/core';
import { ClientApiModule } from './client-api.module';
import { ValidationPipe } from '@nestjs/common';
import { getCorsPolicy } from '@app/auth';
import { getTrustedProxyHops } from '../../../libs/rate-limit/src/rate-limit.module';

async function bootstrap() {
  // Client endpoints exchange small JSON payloads; keep Nest's bounded parser defaults.
  const app = await NestFactory.create(ClientApiModule);
  app.getHttpAdapter().getInstance().set('trust proxy', getTrustedProxyHops());

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  app.enableCors(getCorsPolicy());

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Client API running on port ${port} (Network Accessible)`);
}
bootstrap();
