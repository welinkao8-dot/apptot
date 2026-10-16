export const getReceiptPaymentSummary = (trip) => {
    const rawAmount = trip?.final_fare ?? trip?.estimated_fare;
    const parsedAmount = Number(rawAmount);
    const amount = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
    const payment = trip?.trip_payment;
    const method = payment?.method === 'cash' ? 'Dinheiro' : null;

    let paymentLabel = 'Não registado';
    if (payment?.status === 'confirmed' && method) paymentLabel = `${method} · Confirmado`;
    else if (payment?.status === 'pending' && method) paymentLabel = `${method} · Pendente`;
    else if (method) paymentLabel = `${method} · Estado não confirmado`;

    return {
        amount,
        amountLabel: payment?.status === 'confirmed' ? 'Total pago' : 'Valor da viagem',
        paymentLabel,
    };
};

export const getReceiptTitle = () => 'RESUMO DA VIAGEM';
