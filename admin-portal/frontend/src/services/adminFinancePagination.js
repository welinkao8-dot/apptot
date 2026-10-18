export function buildInvoicesQuery({ page, pageSize, type, search }) {
    return { page, limit: pageSize, type, search: search.trim() }
}

export function buildPaymentsQuery({ page, pageSize, status, search }) {
    return { page, limit: pageSize, status, search: search.trim() }
}

export function formatSummaryValue(summary, key, loading, format = value => value) {
    if (!summary) return loading ? '…' : '—'
    return format(summary[key])
}

function normalizePage(data, validateSummary, label) {
    if (!data || !Array.isArray(data.items) || data.items.some(item => !item || typeof item !== 'object' || typeof item.id !== 'string')
        || !Number.isSafeInteger(data.total) || data.total < 0
        || !Number.isSafeInteger(data.page) || data.page < 1
        || !Number.isSafeInteger(data.pageSize) || data.pageSize < 1
        || !validateSummary(data.summary)) {
        throw new Error(`Resposta paginada de ${label} inválida.`)
    }
    return { items: data.items, total: data.total, page: data.page, pageSize: data.pageSize, summary: data.summary }
}

function hasValidAmount(value) {
    return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
        && Number.isFinite(Number(value)) && Number(value) >= 0
}

export function normalizeInvoicesPage(data) {
    const page = normalizePage(data, summary => summary
        && Number.isFinite(summary.receiptTotal) && summary.receiptTotal >= 0
        && Number.isSafeInteger(summary.monthlyReceiptCount) && summary.monthlyReceiptCount >= 0
        && Array.isArray(summary.invoiceTypes) && summary.invoiceTypes.every(type => typeof type === 'string'), 'faturas')
    if (page.items.some(invoice => !hasValidAmount(invoice.amount))) {
        throw new Error('Resposta paginada de faturas inválida.')
    }
    return page
}

export function normalizePaymentsPage(data) {
    const page = normalizePage(data, summary => summary
        && Number.isSafeInteger(summary.pendingCount) && summary.pendingCount >= 0
        && Number.isSafeInteger(summary.confirmedCount) && summary.confirmedCount >= 0
        && Number.isFinite(summary.confirmedCashTotal) && summary.confirmedCashTotal >= 0
        && Number.isFinite(summary.cashPendingTotal) && summary.cashPendingTotal >= 0, 'pagamentos')
    if (page.items.some(payment => typeof payment.trip_id !== 'string'
        || !['pending', 'confirmed'].includes(payment.status)
        || !hasValidAmount(payment.amount))) {
        throw new Error('Resposta paginada de pagamentos inválida.')
    }
    return page
}

export async function loadFinancePage(adminApi, path, params, normalize) {
    const response = await adminApi.get(path, { params })
    return normalize(response.data)
}

export function createRequestSequence() {
    let current = 0
    return {
        begin: () => ++current,
        isCurrent: requestId => requestId === current,
        invalidate: () => { current += 1 },
    }
}
