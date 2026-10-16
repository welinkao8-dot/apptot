import { ValidationPipe } from '@nestjs/common';
import { NotifyDriverStatusDto } from './driver-api.dto';

describe('NotifyDriverStatusDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  it('accepts only UUID driver IDs and supported account states', async () => {
    await expect(pipe.transform({ driverId: '550e8400-e29b-41d4-a716-446655440000', status: 'suspended' }, {
      type: 'body', metatype: NotifyDriverStatusDto,
    })).resolves.toBeInstanceOf(NotifyDriverStatusDto);
  });

  it.each([
    { driverId: '', status: 'suspended' },
    { driverId: 'd'.repeat(65), status: 'suspended' },
    { driverId: '550e8400-e29b-41d4-a716-446655440000', status: 'pending' },
    { driverId: '550e8400-e29b-41d4-a716-446655440000', status: 'active', extra: true },
  ])('rejects invalid status notification body %p', async (body) => {
    await expect(pipe.transform(body, { type: 'body', metatype: NotifyDriverStatusDto })).rejects.toThrow();
  });
});
