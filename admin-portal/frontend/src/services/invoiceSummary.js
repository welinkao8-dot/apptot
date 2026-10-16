function validAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : 0
}

export function summarizeInvoices(invoices, payments, now = new Date()) {
  const rows = Array.isArray(invoices) ? invoices : []
  const receiptTotal = rows.reduce((sum, invoice) => sum + validAmount(invoice?.amount), 0)
  const monthlyReceiptCount = rows.filter(invoice => {
    const createdAt = new Date(invoice?.created_at)
    return Number.isFinite(createdAt.getTime())
      && createdAt.getFullYear() === now.getFullYear()
      && createdAt.getMonth() === now.getMonth()
  }).length
  const paymentRows = Array.isArray(payments) ? payments : null
  const cashConfirmed = paymentRows?.reduce((sum, payment) => {
    return payment?.method === 'cash' && payment.status === 'confirmed'
      ? sum + validAmount(payment.amount)
      : sum
  }, 0) ?? null
  const cashPending = paymentRows?.reduce((sum, payment) => {
    return payment?.method === 'cash' && payment.status === 'pending'
      ? sum + validAmount(payment.amount)
      : sum
  }, 0) ?? null

  return { receiptTotal, monthlyReceiptCount, cashConfirmed, cashPending }
}
