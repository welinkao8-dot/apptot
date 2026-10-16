import { ValidationPipe } from '@nestjs/common';
import { ChangePasswordDto, CheckPhoneDto, LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto';

describe('client auth DTOs', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  async function transform(body: unknown, metatype: new () => object) {
    return pipe.transform(body, { type: 'body', metatype });
  }

  it('accepts and trims the client sign-in and registration contracts', async () => {
    await expect(transform({ phone: '  +244900000000 ', password: 'secret' }, LoginDto))
      .resolves.toEqual(expect.objectContaining({ phone: '+244900000000', password: 'secret' }));
    await expect(transform({ phone: '+244900000000', fullName: ' Ana Silva ', password: 'secret' }, RegisterDto))
      .resolves.toEqual(expect.objectContaining({ fullName: 'Ana Silva' }));
  });

  it.each([
    [CheckPhoneDto, { phone: 244900000000 }],
    [LoginDto, { phone: '+244900000000', password: '' }],
    [RegisterDto, { phone: '+244900000000', fullName: '   ', password: 'secret' }],
    [ChangePasswordDto, { oldPassword: 'old', newPassword: 123 }],
    [UpdateProfileDto, { fullName: 'Ana', userId: 'client-b' }],
  ])('rejects malformed or untrusted body for %p', async (Dto, body) => {
    await expect(transform(body, Dto as new () => object)).rejects.toThrow();
  });
});
