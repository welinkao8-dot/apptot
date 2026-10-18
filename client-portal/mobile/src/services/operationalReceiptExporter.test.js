jest.mock('react-native-html-to-pdf', () => ({ generatePDF: jest.fn() }));
jest.mock('react-native-share', () => ({ __esModule: true, default: { open: jest.fn() } }));

import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';

let exporter;
try {
    exporter = require('./operationalReceiptExporter');
} catch {
    exporter = null;
}

describe('shareOperationalReceipt', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates a PDF and opens the system share sheet with that local file', async () => {
        expect(typeof exporter?.shareOperationalReceipt).toBe('function');
        if (typeof exporter?.shareOperationalReceipt !== 'function') return;

        generatePDF.mockResolvedValue({ filePath: '/cache/tot-registo-12345678.pdf' });
        Share.open.mockResolvedValue({ dismissedAction: false });
        const trip = {
            id: '12345678-1234-1234-1234-123456789012',
            status: 'completed',
            trip_payment: { status: 'confirmed', amount: '950.00', confirmed_at: '2026-10-18T10:45:00.000Z' },
        };

        await exporter.shareOperationalReceipt(trip);

        expect(generatePDF).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'tot-registo-12345678-1234-1234-1234-123456789012',
            base64: false,
        }));
        expect(Share.open).toHaveBeenCalledWith(expect.objectContaining({
            url: 'file:///cache/tot-registo-12345678.pdf',
            type: 'application/pdf',
            failOnCancel: false,
        }));
    });

    it('does not open sharing when PDF generation returns no file', async () => {
        expect(typeof exporter?.shareOperationalReceipt).toBe('function');
        if (typeof exporter?.shareOperationalReceipt !== 'function') return;

        generatePDF.mockResolvedValue({ filePath: '' });

        await expect(exporter.shareOperationalReceipt({
            id: 'trip-1', status: 'completed', trip_payment: { status: 'confirmed', confirmed_at: '2026-10-18T10:45:00.000Z' },
        })).rejects.toThrow('Não foi possível criar o ficheiro PDF.');
        expect(Share.open).not.toHaveBeenCalled();
    });

    it('does not generate or share a receipt while server payment is pending', async () => {
        await expect(exporter.shareOperationalReceipt({
            id: 'trip-2', status: 'completed', trip_payment: { status: 'pending' },
        })).rejects.toThrow('Só é possível gerar o recibo após a confirmação do pagamento pelo servidor.');
        expect(generatePDF).not.toHaveBeenCalled();
        expect(Share.open).not.toHaveBeenCalled();
    });
});
