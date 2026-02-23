import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AdminApiModule } from './admin-api.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AdminApiModule);
  app.enableCors();

  // Serve static files from the uploads directory
  app.useStaticAssets(join(__dirname, '..', '..', '..', 'uploads'), {
    prefix: '/uploads/',
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
