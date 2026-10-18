import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { buildOperationalReceiptHtml, getOperationalReceiptFileName } from '../utils/receiptSummary';

export async function shareOperationalReceipt(trip) {
    const fileName = getOperationalReceiptFileName(trip);
    const pdf = await generatePDF({
        html: buildOperationalReceiptHtml(trip),
        fileName,
        base64: false,
    });
    const filePath = typeof pdf?.filePath === 'string' ? pdf.filePath.trim() : '';
    if (!filePath) throw new Error('Não foi possível criar o ficheiro PDF.');

    const fileUri = /^(file|content):\/\//i.test(filePath) ? filePath : `file://${filePath}`;
    return Share.open({
        url: fileUri,
        type: 'application/pdf',
        title: 'Guardar ou imprimir recibo TOT',
        subject: 'Recibo operacional TOT',
        filename: `${fileName}.pdf`,
        failOnCancel: false,
    });
}
