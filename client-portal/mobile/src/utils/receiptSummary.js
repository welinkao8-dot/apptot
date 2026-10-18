export const getReceiptPaymentSummary = (trip) => {
    const payment = trip?.trip_payment;
    const rawAmount = payment?.status === 'confirmed'
        ? payment.amount ?? trip?.final_fare ?? trip?.estimated_fare
        : trip?.final_fare ?? trip?.estimated_fare;
    const parsedAmount = Number(rawAmount);
    const amount = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
    const method = payment?.method === 'cash' ? 'Dinheiro' : null;

    let paymentLabel = 'Não registado';
    if (payment?.status === 'confirmed') paymentLabel = method ? `${method} · Confirmado` : 'Pagamento confirmado';
    else if (payment?.status === 'pending') paymentLabel = method ? `${method} · Pendente` : 'Pagamento pendente';
    else if (method) paymentLabel = `${method} · Estado não confirmado`;

    return {
        amount,
        amountLabel: payment?.status === 'confirmed' ? 'Total pago' : 'Valor da viagem',
        paymentLabel,
    };
};

export const canGenerateOperationalReceipt = (trip) => (
    trip?.status === 'completed' &&
    trip?.trip_payment?.status === 'confirmed' &&
    Boolean(trip?.trip_payment?.confirmed_at)
);

export const getReceiptTitle = (trip) => canGenerateOperationalReceipt(trip) ? 'RECIBO OPERACIONAL' : 'RESUMO DA VIAGEM';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatReceiptDate = (value) => {
    if (!value) return 'Data não disponível';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Data não disponível';
    return date.toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatReceiptAmount = (value) => Number(value).toLocaleString('pt-PT', { maximumFractionDigits: 2 });

export const getOperationalReceiptFileName = (trip) => {
    const safeId = String(trip?.id ?? 'viagem').replace(/[^a-zA-Z0-9-]/g, '') || 'viagem';
    return `tot-registo-${safeId}`;
};

export const buildOperationalReceiptHtml = (trip) => {
    if (!canGenerateOperationalReceipt(trip)) {
        throw new Error('Só é possível gerar o recibo após a confirmação do pagamento pelo servidor.');
    }
    const paymentSummary = getReceiptPaymentSummary(trip);
    const tripId = String(trip?.id ?? '').replace(/[^a-zA-Z0-9-]/g, '');
    const tripReference = tripId ? `#TOT-${tripId.slice(0, 8).toUpperCase()}` : 'Não disponível';
    const serviceType = trip?.category === 'delivery' ? 'Entrega' : 'Corrida';
    const tripStatus = trip?.status === 'completed' ? 'Concluída' : trip?.status === 'cancelled' ? 'Cancelada' : 'Não concluída';
    const payment = trip?.trip_payment;
    const paymentNote = payment?.status === 'confirmed'
        ? `Pagamento confirmado pelo servidor${payment.confirmed_at ? ` em ${formatReceiptDate(payment.confirmed_at)}` : ''}.`
        : payment?.status === 'pending'
            ? 'Pagamento pendente; este documento não comprova recebimento.'
            : 'Pagamento não registado; este documento não comprova recebimento.';
    const amountLabel = paymentSummary.amountLabel;
    const amount = `Kz ${formatReceiptAmount(paymentSummary.amount)}`;
    const routeStart = trip?.origin_address || 'Não informado';
    const routeEnd = trip?.dest_address || 'Não informado';
    const createdAt = formatReceiptDate(trip?.completed_at ?? trip?.created_at);

    return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(getReceiptTitle(trip))} ${escapeHtml(tripReference)}</title>
<style>
@page { size: A4; margin: 20mm; }
* { box-sizing: border-box; }
body { color: #182033; font-family: Arial, sans-serif; margin: 0; }
.receipt { border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
.brand { color: #c2185b; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
h1 { font-size: 24px; margin: 12px 0 4px; }
.notice { color: #64748b; font-size: 12px; margin: 0 0 24px; }
.row { border-bottom: 1px solid #e5e7eb; padding: 14px 0; }
.label { color: #64748b; display: block; font-size: 10px; font-weight: 700; letter-spacing: 1px; margin-bottom: 6px; text-transform: uppercase; }
.value { font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.amount { color: #c2185b; font-size: 20px; font-weight: 700; }
.disclaimer { background: #f8fafc; border-radius: 8px; color: #475569; font-size: 11px; line-height: 1.5; margin-top: 24px; padding: 12px; }
</style>
</head>
<body>
<main class="receipt">
<div class="brand">TOT · Documento não fiscal</div>
<h1>${escapeHtml(getReceiptTitle(trip))}</h1>
<p class="notice">Registo operacional da viagem para guardar ou partilhar.</p>
<section class="row"><span class="label">Referência</span><span class="value">${escapeHtml(tripReference)}</span></section>
<section class="row"><span class="label">Serviço</span><span class="value">${escapeHtml(serviceType)} · ${escapeHtml(tripStatus)}</span></section>
<section class="row"><span class="label">Data da viagem</span><span class="value">${escapeHtml(createdAt)}</span></section>
<section class="row"><span class="label">Origem</span><span class="value">${escapeHtml(routeStart)}</span></section>
<section class="row"><span class="label">Destino</span><span class="value">${escapeHtml(routeEnd)}</span></section>
<section class="row"><span class="label">${escapeHtml(amountLabel)}</span><span class="value amount">${escapeHtml(amount)}</span></section>
<section class="row"><span class="label">Pagamento</span><span class="value">${escapeHtml(paymentSummary.paymentLabel)}. ${escapeHtml(paymentNote)}</span></section>
<p class="disclaimer">Este recibo é um registo operacional gerado pela app TOT. Não é uma factura fiscal nem substitui um documento fiscal.</p>
</main>
</body>
</html>`;
};
