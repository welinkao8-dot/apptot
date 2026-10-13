import { NestFactory } from '@nestjs/core';
import { ClientApiModule } from './client-api.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  // Disable default bodyParser to prevent 413 errors
  const app = await NestFactory.create(ClientApiModule, { bodyParser: false });

  // Increase body size limit for potential file uploads
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS must be configured in production.');
  }
  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : process.env.NODE_ENV !== 'production',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Client API running on port ${port} (Network Accessible)`);
}
bootstrap();
