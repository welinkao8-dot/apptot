import { normalizeDeliveryInfo } from './deliveryInfo';

describe('normalizeDeliveryInfo', () => {
  it('trims recipient data and normalizes Angola phone formatting', () => {
    expect(normalizeDeliveryInfo({
      recipientName: ' Ana Silva ', recipientPhone: '+244 923 456 789', packageDescription: ' Documentos ',
    })).toEqual({
      valid: true,
      value: { recipientName: 'Ana Silva', recipientPhone: '+244923456789', packageDescription: 'Documentos' },
    });
  });

  it('rejects blank fields, non-Angola phone numbers, and values beyond API limits', () => {
    expect(normalizeDeliveryInfo({ recipientName: ' ', recipientPhone: '923456789', packageDescription: 'Pasta' }).valid).toBe(false);
    expect(normalizeDeliveryInfo({ recipientName: 'Ana', recipientPhone: '123456789', packageDescription: 'Pasta' }).reason).toBe('phone');
    expect(normalizeDeliveryInfo({ recipientName: 'x'.repeat(151), recipientPhone: '923456789', packageDescription: 'Pasta' }).valid).toBe(false);
    expect(normalizeDeliveryInfo({ recipientName: 'Ana', recipientPhone: '923456789', packageDescription: 'x'.repeat(501) }).valid).toBe(false);
  });
});
