import { NestFactory } from '@nestjs/core';
import { DriverApiModule } from './driver-api.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { getCorsPolicy } from '@app/auth';

async function bootstrap() {
  // Disable default bodyParser to avoid limit issues
  const app = await NestFactory.create(DriverApiModule, { bodyParser: false });

  // Document images arrive as base64 JSON and receive a bounded, route-specific limit.
  app.use('/auth/update-docs', bodyParser.json({ limit: '38mb' }));
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  // Enable CORS for Frontend Access
  app.enableCors(getCorsPolicy());

  const port = process.env.PORT || 3004;
  await app.listen(port, '0.0.0.0');
  console.log(`Driver API running on port ${port}`);
}
bootstrap();
