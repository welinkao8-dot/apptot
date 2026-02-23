import { NestFactory } from '@nestjs/core';
import { DriverApiModule } from './driver-api.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  // Disable default bodyParser to avoid limit issues
  const app = await NestFactory.create(DriverApiModule, { bodyParser: false });

  // Increase body size limit for document uploads (50mb safe for 3 images)
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Enable Global Validation
  // app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Enable CORS for Frontend Access
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3004;
  await app.listen(port, '0.0.0.0');
  console.log(`Driver API running on port ${port}`);
}
bootstrap();
