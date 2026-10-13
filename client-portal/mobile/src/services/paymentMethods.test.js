import { isPaymentMethodEnabled } from './paymentMethods';

describe('configured payment methods', () => {
    it('allows cash and keeps digital methods unavailable without a provider', () => {
        expect(isPaymentMethodEnabled('cash')).toBe(true);
        expect(isPaymentMethodEnabled('card')).toBe(false);
        expect(isPaymentMethodEnabled('multicaixa')).toBe(false);
    });
});
