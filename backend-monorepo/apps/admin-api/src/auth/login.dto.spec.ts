import { ValidationPipe } from '@nestjs/common';
import { AdminLoginDto } from './login.dto';

describe('AdminLoginDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  it('normalizes the login email and rejects malformed/untrusted fields', async () => {
    await expect(pipe.transform({ email: ' ADMIN@example.com ', password: 'secret' }, {
      type: 'body', metatype: AdminLoginDto,
    })).resolves.toEqual(expect.objectContaining({ email: 'admin@example.com' }));
    await expect(pipe.transform({ email: 'invalid', password: 'secret' }, {
      type: 'body', metatype: AdminLoginDto,
    })).rejects.toThrow();
    await expect(pipe.transform({ email: 'admin@example.com', password: 'secret', role: 'admin' }, {
      type: 'body', metatype: AdminLoginDto,
    })).rejects.toThrow();
  });
});
