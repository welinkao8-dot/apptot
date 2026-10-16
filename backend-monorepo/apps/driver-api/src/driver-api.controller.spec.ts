import { Test, TestingModule } from '@nestjs/testing';
import { DriverApiController } from './driver-api.controller';
import { DriverApiService } from './driver-api.service';
import { RidesGateway } from './rides/rides.gateway';
import { InternalServiceTokenGuard } from '@app/auth';
import { ConfigService } from '@nestjs/config';

describe('DriverApiController', () => {
  let driverApiController: DriverApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DriverApiController],
      providers: [
        { provide: DriverApiService, useValue: { getHello: () => 'Hello World!' } },
        { provide: RidesGateway, useValue: {} },
        { provide: InternalServiceTokenGuard, useValue: { canActivate: () => true } },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    driverApiController = app.get<DriverApiController>(DriverApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(driverApiController.getHello()).toBe('Hello World!');
    });
  });
});
