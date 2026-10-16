import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeInvoices } from './invoiceSummary.js'

test('separates issued receipts from cash actually confirmed', () => {
  const summary = summarizeInvoices([
    { amount: '1000.00', created_at: '2026-10-02T10:00:00Z' },
    { amount: '500.00', created_at: '2026-10-03T10:00:00Z' },
    { amount: '700.00', created_at: '2026-10-04T10:00:00Z' },
  ], [
    { method: 'cash', status: 'confirmed', amount: '1000.00' },
    { method: 'cash', status: 'pending', amount: '500.00' },
    { method: 'card', status: 'confirmed', amount: '700.00' },
  ], new Date('2026-10-15T00:00:00Z'))

  assert.deepEqual(summary, { receiptTotal: 2200, monthlyReceiptCount: 3, cashConfirmed: 1000, cashPending: 500 })
})

test('ignores malformed receipt and payment amounts instead of showing NaN', () => {
  const summary = summarizeInvoices([
    { amount: 'invalid', created_at: 'invalid-date' },
  ], [{ method: 'cash', status: 'confirmed', amount: 'invalid' }], new Date('2026-10-15T00:00:00Z'))

  assert.deepEqual(summary, { receiptTotal: 0, monthlyReceiptCount: 0, cashConfirmed: 0, cashPending: 0 })
})

test('does not show zero as a cash total when the payment ledger could not be loaded', () => {
  const summary = summarizeInvoices([], null)
  assert.equal(summary.cashConfirmed, null)
  assert.equal(summary.cashPending, null)
})
