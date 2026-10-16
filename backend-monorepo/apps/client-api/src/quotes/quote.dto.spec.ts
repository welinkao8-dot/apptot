import { ValidationPipe } from '@nestjs/common';
import { CreateQuoteDto } from './quote.dto';

describe('CreateQuoteDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const transform = (body: unknown) => pipe.transform(body, { type: 'body', metatype: CreateQuoteDto });
  const base = {
    category: 'delivery',
    originAddress: 'Origem', originLat: -8.8, originLng: 13.2,
    destAddress: 'Destino', destLat: -8.9, destLng: 13.3,
  };

  it('requires normalized and bounded recipient details for deliveries', async () => {
    await expect(transform({ ...base, deliveryInfo: {
      recipientName: '  Ana Silva ', recipientPhone: '9 23 456 789', packageDescription: '  Documentos  ',
    } })).resolves.toEqual(expect.objectContaining({ deliveryInfo: {
      recipientName: 'Ana Silva', recipientPhone: '923456789', packageDescription: 'Documentos',
    } }));
  });

  it('rejects missing recipient details, invalid phone, excessive description and unknown nested keys', async () => {
    await expect(transform(base)).rejects.toThrow();
    await expect(transform({ ...base, deliveryInfo: { recipientName: 'Ana', recipientPhone: '123', packageDescription: 'Pasta' } })).rejects.toThrow();
    await expect(transform({ ...base, deliveryInfo: { recipientName: 'Ana', recipientPhone: '923456789', packageDescription: 'x'.repeat(501) } })).rejects.toThrow();
    await expect(transform({ ...base, deliveryInfo: { recipientName: 'Ana', recipientPhone: '923456789', packageDescription: 'Pasta', customerId: 'other' } })).rejects.toThrow();
  });
});
