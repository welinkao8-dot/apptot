import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '@app/database';
import { ForbiddenException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('only accepts document updates while a driver is awaiting document review', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const guardedController = new AuthController({} as never, { drivers: { updateMany } } as never);

    await expect(guardedController.updateDocs({
      bi_frente: 'data:image/jpeg;base64,/9j/',
      bi_verso: 'data:image/jpeg;base64,/9j/',
      carta: 'data:image/jpeg;base64,/9j/',
    }, { sub: 'driver-a' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'driver-a', status: { in: ['pending_docs', 'pending'] } },
    }));
  });
});
