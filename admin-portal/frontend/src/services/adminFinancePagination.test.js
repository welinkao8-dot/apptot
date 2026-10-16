import test from 'node:test'
import assert from 'node:assert/strict'
import {
    buildInvoicesQuery,
    buildPaymentsQuery,
    createRequestSequence,
    formatSummaryValue,
    loadFinancePage,
    normalizeInvoicesPage,
    normalizePaymentsPage,
} from './adminFinancePagination.js'

test('does not report zero financial KPIs when the summary has not loaded', () => {
    assert.equal(formatSummaryValue(null, 'pendingCount', true), '…')
    assert.equal(formatSummaryValue(null, 'pendingCount', false), '—')
    assert.equal(formatSummaryValue({ pendingCount: 0 }, 'pendingCount', false), 0)
})

test('builds server queries with trimmed search and the selected filters', () => {
    assert.deepEqual(buildInvoicesQuery({ page: 2, pageSize: 10, type: 'ride', search: '  Ana ' }), {
        page: 2, limit: 10, type: 'ride', search: 'Ana',
    })
    assert.deepEqual(buildPaymentsQuery({ page: 3, pageSize: 20, status: 'pending', search: ' trip-a ' }), {
        page: 3, limit: 20, status: 'pending', search: 'trip-a',
    })
})

test('validates page envelopes and full invoice/payment summaries', () => {
    assert.deepEqual(normalizeInvoicesPage({
        items: [{ id: 'invoice-a' }], total: 15, page: 2, pageSize: 10,
        summary: { receiptTotal: 500, monthlyReceiptCount: 3, invoiceTypes: ['ride'] },
    }).summary, { receiptTotal: 500, monthlyReceiptCount: 3, invoiceTypes: ['ride'] })
    assert.deepEqual(normalizePaymentsPage({
        items: [{ id: 'payment-a', trip_id: 'trip-a', status: 'pending' }], total: 20, page: 1, pageSize: 20,
        summary: { pendingCount: 4, confirmedCount: 16, confirmedCashTotal: 900, cashPendingTotal: 100 },
    }).summary, { pendingCount: 4, confirmedCount: 16, confirmedCashTotal: 900, cashPendingTotal: 100 })
    assert.throws(() => normalizeInvoicesPage({ items: [], total: -1, page: 1, pageSize: 10, summary: {} }), /inválida/)
    assert.throws(() => normalizePaymentsPage({ items: [], total: 0, page: 1, pageSize: 10, summary: {} }), /inválida/)
})

test('only the newest finance request may publish a result', () => {
    const requests = createRequestSequence()
    const oldRequest = requests.begin()
    const latestRequest = requests.begin()
    assert.equal(requests.isCurrent(oldRequest), false)
    assert.equal(requests.isCurrent(latestRequest), true)
    requests.invalidate()
    assert.equal(requests.isCurrent(latestRequest), false)
})

test('a failed page request can be retried and recover with a valid response', async () => {
    const expected = { items: [], total: 0, page: 1, pageSize: 10, summary: { receiptTotal: 0, monthlyReceiptCount: 0, invoiceTypes: [] } }
    let attempts = 0
    const api = { get: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('temporary failure')
        return { data: expected }
    } }
    await assert.rejects(loadFinancePage(api, '/admin/invoices', { page: 1 }, normalizeInvoicesPage), /temporary failure/)
    assert.deepEqual(await loadFinancePage(api, '/admin/invoices', { page: 1 }, normalizeInvoicesPage), expected)
    assert.equal(attempts, 2)
})
