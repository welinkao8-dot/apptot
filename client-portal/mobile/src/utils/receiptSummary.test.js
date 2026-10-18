import { canGenerateOperationalReceipt, getReceiptPaymentSummary, getReceiptTitle } from './receiptSummary';
import * as receiptUtils from './receiptSummary';

describe('getReceiptTitle', () => {
    it('labels the document as an operational, non-fiscal receipt', () => {
        expect(getReceiptTitle({ status: 'completed', trip_payment: { status: 'confirmed', confirmed_at: '2026-10-18T10:45:00Z' } })).toBe('RECIBO OPERACIONAL');
        expect(getReceiptTitle({ status: 'completed', trip_payment: { status: 'pending' } })).toBe('RESUMO DA VIAGEM');
        expect(getReceiptTitle({ status: 'cancelled', trip_payment: { status: 'confirmed', confirmed_at: '2026-10-18T10:45:00Z' } })).toBe('RESUMO DA VIAGEM');
    });
});

describe('canGenerateOperationalReceipt', () => {
    it('requires a completed trip and server-confirmed payment timestamp', () => {
        expect(canGenerateOperationalReceipt({ status: 'completed', trip_payment: { status: 'confirmed', confirmed_at: '2026-10-18T10:45:00Z' } })).toBe(true);
        expect(canGenerateOperationalReceipt({ status: 'completed', trip_payment: { status: 'pending' } })).toBe(false);
        expect(canGenerateOperationalReceipt({ status: 'completed', trip_payment: { status: 'confirmed' } })).toBe(false);
        expect(canGenerateOperationalReceipt({ status: 'cancelled', trip_payment: { status: 'confirmed', confirmed_at: '2026-10-18T10:45:00Z' } })).toBe(false);
    });
});

describe('getReceiptPaymentSummary', () => {
    it('uses persisted cash payment status and amount', () => {
        expect(getReceiptPaymentSummary({
            final_fare: '950.00',
            trip_payment: { status: 'confirmed', method: 'cash', amount: '950.00' },
        })).toEqual({ amount: 950, amountLabel: 'Total pago', paymentLabel: 'Dinheiro · Confirmado' });
    });

    it('uses the confirmed payment amount when it differs from the trip fare', () => {
        expect(getReceiptPaymentSummary({
            final_fare: '1200.00',
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

describe('buildOperationalReceiptHtml', () => {
    it('creates a printable non-fiscal receipt and escapes trip-controlled text', () => {
        const build = receiptUtils.buildOperationalReceiptHtml;
        expect(build).toEqual(expect.any(Function));
        if (typeof build !== 'function') return;

        const html = build({
            id: '12345678-1234-1234-1234-123456789012',
            status: 'completed',
            category: 'ride',
            origin_address: '<script>alert("x")</script>',
            dest_address: 'Centro & Baixa',
            final_fare: '950.00',
            created_at: '2026-10-18T10:30:00.000Z',
            trip_payment: { method: 'cash', status: 'confirmed', confirmed_at: '2026-10-18T10:45:00.000Z' },
        });

        expect(html).toContain('RECIBO OPERACIONAL');
        expect(html).toMatch(/documento não fiscal/i);
        expect(html).toContain('Pagamento confirmado pelo servidor');
        expect(html).toContain('Kz 950');
        expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
        expect(html).not.toContain('<script>alert');
        expect(html).toContain('Centro &amp; Baixa');
    });

    it('states payment only as confirmed when the persisted payment is confirmed', () => {
        const build = receiptUtils.buildOperationalReceiptHtml;
        expect(build).toEqual(expect.any(Function));
        if (typeof build !== 'function') return;

        const html = build({
            id: '12345678-1234-1234-1234-123456789012',
            status: 'completed',
            final_fare: '950.00',
            trip_payment: { method: 'cash', status: 'confirmed', confirmed_at: '2026-10-18T10:45:00.000Z' },
        });

        expect(html).toContain('Pagamento confirmado');
        expect(html).toContain('Pagamento confirmado pelo servidor');
    });

    it('refuses to produce any receipt HTML while payment is pending', () => {
        expect(() => receiptUtils.buildOperationalReceiptHtml({
            id: '12345678-1234-1234-1234-123456789012',
            status: 'completed',
            final_fare: '950.00',
            trip_payment: { status: 'pending' },
        })).toThrow('Só é possível gerar o recibo após a confirmação do pagamento pelo servidor.');
    });
});

describe('getOperationalReceiptFileName', () => {
    it('uses a filesystem-safe short trip reference', () => {
        expect(receiptUtils.getOperationalReceiptFileName({ id: '12 / 34567890-abcd' })).toBe('tot-registo-1234567890-abcd');
    });
});
