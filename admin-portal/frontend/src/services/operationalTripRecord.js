const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = value => {
    if (!value) return 'Data não disponível';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Data não disponível';
    return date.toLocaleString('pt-AO', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatAmount = value => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return 'Não disponível';
    return `Kz ${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(amount)}`;
};

const paymentSummary = trip => {
    const payment = trip?.trip_payment;
    if (payment?.status === 'confirmed') {
        const method = payment.method === 'cash' ? 'Dinheiro' : null;
        const confirmedAt = payment.confirmed_at ? ` em ${formatDate(payment.confirmed_at)}` : '';
        return {
            label: method ? `${method} · Confirmado` : 'Pagamento confirmado',
            amount: payment.amount ?? trip?.final_fare ?? trip?.estimated_fare,
            note: `Pagamento confirmado pelo servidor${confirmedAt}.`,
        };
    }
    if (payment?.status === 'pending') {
        const method = payment.method === 'cash' ? 'Dinheiro' : null;
        return {
            label: method ? `${method} · Pendente` : 'Pagamento pendente',
            amount: trip?.final_fare ?? trip?.estimated_fare,
            note: 'Pagamento pendente; este documento não comprova recebimento.',
        };
    }
    return {
        label: 'Não registado',
        amount: trip?.final_fare ?? trip?.estimated_fare,
        note: 'Pagamento não registado; este documento não comprova recebimento.',
    };
};

export function buildOperationalTripRecordHtml(trip) {
    assertConfirmedTripPayment(trip);
    const id = String(trip?.id ?? '').replace(/[^a-zA-Z0-9-]/g, '');
    const reference = id ? `#TOT-${id.slice(0, 8).toUpperCase()}` : 'Não disponível';
    const completed = trip?.status === 'completed';
    const title = completed ? 'RECIBO OPERACIONAL' : 'REGISTO DA VIAGEM';
    const status = trip?.status === 'completed' ? 'Concluída' : trip?.status === 'cancelled' ? 'Cancelada' : 'Não concluída';
    const payment = paymentSummary(trip);
    const amountLabel = trip?.trip_payment?.status === 'confirmed' ? 'Total pago' : 'Valor da viagem';
    const rows = [
        ['Referência', reference],
        ['Estado', status],
        ['Data', formatDate(trip?.completed_at ?? trip?.created_at)],
        ['Cliente', trip?.profiles_trips_client_idToprofiles?.full_name || 'Não identificado'],
        ['Motorista', trip?.profiles_trips_driver_idToprofiles?.full_name || 'Sem motorista'],
        ['Origem', trip?.origin_address || 'Não registada'],
        ['Destino', trip?.dest_address || 'Não registado'],
        [amountLabel, formatAmount(payment.amount)],
        ['Pagamento', `${payment.label}. ${payment.note}`],
    ];
    const content = rows.map(([label, value]) => `<section class="row"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></section>`).join('');

    return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} ${escapeHtml(reference)}</title>
<style>
@page{size:A4;margin:20mm}*{box-sizing:border-box}body{color:#182033;font-family:Arial,sans-serif;margin:0}.record{border:1px solid #e5e7eb;border-radius:12px;padding:32px}.brand{color:#c2185b;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase}h1{font-size:24px;margin:12px 0 4px}.notice{color:#64748b;font-size:12px;margin:0 0 24px}.row{border-bottom:1px solid #e5e7eb;padding:12px 0}.label{color:#64748b;display:block;font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:6px;text-transform:uppercase}.value{font-size:14px;line-height:1.5;overflow-wrap:anywhere}.disclaimer{background:#f8fafc;border-radius:8px;color:#475569;font-size:11px;line-height:1.5;margin-top:24px;padding:12px}
</style></head><body><main class="record"><div class="brand">TOT · Documento não fiscal</div><h1>${escapeHtml(title)}</h1><p class="notice">Registo operacional da viagem para guardar ou partilhar.</p>${content}<p class="disclaimer">Este documento é um registo operacional do painel TOT. Não é uma factura fiscal nem substitui um documento fiscal.</p></main></body></html>`;
}

export function assertConfirmedTripPayment(trip) {
    if (trip?.status !== 'completed' || trip?.trip_payment?.status !== 'confirmed' || !trip?.trip_payment?.confirmed_at) {
        throw new Error('Só é possível guardar o recibo após a confirmação do pagamento pelo servidor.');
    }
}

export async function fetchConfirmedTripRecord(tripId, fetchTrip) {
    const response = await fetchTrip(tripId);
    const trip = response?.data;
    if (!trip || trip.id !== tripId) throw new Error('Não foi possível confirmar os dados da corrida no servidor.');
    assertConfirmedTripPayment(trip);
    return trip;
}

export function openOperationalTripRecord(trip, browser = window, existingPopup = null) {
    assertConfirmedTripPayment(trip);
    const popup = existingPopup || browser.open('', '_blank');
    if (!popup) throw new Error('Permita a janela de impressão para guardar o PDF.');
    popup.opener = null;
    popup.document.open();
    popup.document.write(buildOperationalTripRecordHtml(trip));
    popup.document.close();
    popup.setTimeout(() => {
        popup.focus();
        popup.print();
    }, 250);
}
