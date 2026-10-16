import { getReceiptPaymentSummary, getReceiptTitle } from './receiptSummary';

describe('getReceiptTitle', () => {
    it('labels payment details as a summary until a real fiscal document exists', () => {
        expect(getReceiptTitle({ trip_payment: { status: 'confirmed', method: 'cash' } })).toBe('RESUMO DA VIAGEM');
    });
});

describe('getReceiptPaymentSummary', () => {
    it('uses persisted cash payment status and amount', () => {
        expect(getReceiptPaymentSummary({
            final_fare: '950.00',
            trip_payment: { status: 'confirmed', method: 'cash', amount: '950.00' },
        })).toEqual({ amount: 950, amountLabel: 'Total pago', paymentLabel: 'Dinheiro · Confirmado' });
    });

    it('does not claim a cancelled or unpaid trip was paid', () => {
        expect(getReceiptPaymentSummary({
            status: 'cancelled',
            estimated_fare: '950.00',
            trip_payment: null,
        })).toEqual({ amount: 950, amountLabel: 'Valor da viagem', paymentLabel: 'Não registado' });
    });
});
