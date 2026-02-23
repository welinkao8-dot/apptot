import { Test, TestingModule } from '@nestjs/testing';
import { DriverApiController } from './driver-api.controller';
import { DriverApiService } from './driver-api.service';

describe('DriverApiController', () => {
  let driverApiController: DriverApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DriverApiController],
      providers: [DriverApiService],
    }).compile();

    driverApiController = app.get<DriverApiController>(DriverApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(driverApiController.getHello()).toBe('Hello World!');
    });
  });
});
