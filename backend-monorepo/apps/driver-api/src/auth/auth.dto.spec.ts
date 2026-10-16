import { ValidationPipe } from '@nestjs/common';
import { DriverChangePasswordDto, DriverCheckPhoneDto, DriverLoginDto, DriverRegisterDto, DriverUpdateDocsDto, DriverUpdateProfileDto } from './auth.dto';

describe('driver auth DTOs', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const transform = (body: unknown, metatype: new () => object) => pipe.transform(body, { type: 'body', metatype });

  it('accepts valid phone login and trims registration/profile fields', async () => {
    await expect(transform({ phone: ' +244900000000 ', password: 'secret' }, DriverLoginDto))
      .resolves.toEqual(expect.objectContaining({ phone: '+244900000000' }));
    await expect(transform({ phone: '+244900000000', password: 'secret', full_name: ' Ana Silva ', email: ' ana@example.com ', vehicle_category: 'moto' }, DriverRegisterDto))
      .resolves.toEqual(expect.objectContaining({ full_name: 'Ana Silva', email: 'ana@example.com', vehicle_category: 'moto' }));
    await expect(transform({ full_name: ' Ana ' }, DriverUpdateProfileDto))
      .resolves.toEqual(expect.objectContaining({ full_name: 'Ana' }));
  });

  it.each([
    [DriverCheckPhoneDto, { phone: '' }],
    [DriverLoginDto, { phone: '+244900000000', password: '' }],
    [DriverRegisterDto, { phone: '+244900000000', password: 'secret', full_name: '   ' }],
    [DriverRegisterDto, { phone: '+244900000000', password: 'secret', full_name: 'Ana Silva' }],
    [DriverRegisterDto, { phone: '+244900000000', password: 'secret', full_name: 'Ana Silva', vehicle_category: 'spaceship' }],
    [DriverChangePasswordDto, { currentPassword: 'old', newPassword: 12 }],
    [DriverUpdateProfileDto, { full_name: 'Ana', driverId: 'driver-b' }],
    [DriverUpdateDocsDto, { bi_frente: 'x', bi_verso: 'y', carta: 'z', driverId: 'driver-b' }],
  ])('rejects invalid and untrusted request data for %p', async (Dto, body) => {
    await expect(transform(body, Dto as new () => object)).rejects.toThrow();
  });

  it('rejects document payloads that are not supported image data URIs', async () => {
    await expect(transform({
      bi_frente: 'data:text/html;base64,PHNjcmlwdD4=',
      bi_verso: 'data:image/jpeg;base64,@@@',
      carta: 'https://untrusted.example/document.jpg',
    }, DriverUpdateDocsDto)).rejects.toThrow();
  });
});
