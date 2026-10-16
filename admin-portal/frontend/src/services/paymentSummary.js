export function getPaymentSummary(payments) {
  const rows = Array.isArray(payments) ? payments : []
  const confirmed = rows.filter((payment) => payment?.status === 'confirmed')
  const confirmedCashTotal = confirmed
    .filter((payment) => payment.method === 'cash')
    .reduce((total, payment) => {
      const amount = Number(payment.amount)
      return Number.isFinite(amount) && amount > 0 ? total + amount : total
    }, 0)

  return {
    pendingCount: rows.filter((payment) => payment?.status === 'pending').length,
    confirmedCount: confirmed.length,
    confirmedCashTotal,
  }
}
