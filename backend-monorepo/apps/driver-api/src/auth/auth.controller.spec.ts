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
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      drivers: { updateMany },
      driver_documents: { updateMany: jest.fn(), create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (tx: typeof tx) => unknown) => callback(tx)) };
    const guardedController = new AuthController({} as never, prisma as never);

    await expect(guardedController.updateDocs({
      bi_frente: 'data:image/jpeg;base64,/9j/',
      bi_verso: 'data:image/jpeg;base64,/9j/',
      carta: 'data:image/jpeg;base64,/9j/',
    }, { sub: 'driver-a' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'driver-a', status: { in: ['pending_docs', 'pending'] } },
    }));
    expect(tx.driver_documents.create).not.toHaveBeenCalled();
  });

  it('stores driver document bytes in a transaction and never writes data URIs into the driver row', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      drivers: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      driver_documents: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = { $transaction: jest.fn((callback: (tx: typeof tx) => unknown) => callback(tx)) };
    const guardedController = new AuthController({} as never, prisma as never);
    const image = 'data:image/jpeg;base64,/9j/';

    await expect(guardedController.updateDocs({ bi_frente: image, bi_verso: image, carta: image }, { sub: 'driver-a' } as never))
      .resolves.toEqual({ success: true });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.drivers.updateMany.mock.calls[0][0].data).not.toHaveProperty('doc_bi_frente');
    expect(tx.driver_documents.create).toHaveBeenCalledTimes(3);
    expect(tx.driver_documents.create.mock.calls[0][0].data).toMatchObject({
      driver_id: 'driver-a', document_type: 'bi_frente', content: Buffer.from([0xff, 0xd8, 0xff]), mime_type: 'image/jpeg', size_bytes: 3,
    });
    expect(tx.driver_documents.create.mock.calls[0][0].data).not.toHaveProperty('data_uri');
  });
});
