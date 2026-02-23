import { Test, TestingModule } from '@nestjs/testing';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';

describe('ClientApiController', () => {
  let clientApiController: ClientApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ClientApiController],
      providers: [ClientApiService],
    }).compile();

    clientApiController = app.get<ClientApiController>(ClientApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(clientApiController.getHello()).toBe('Hello World!');
    });
  });
});
