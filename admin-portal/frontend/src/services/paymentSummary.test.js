import test from 'node:test'
import assert from 'node:assert/strict'
import { getPaymentSummary } from './paymentSummary.js'

test('counts and totals only cash payments confirmed in the persisted ledger', () => {
  assert.deepEqual(getPaymentSummary([
    { status: 'pending', method: 'cash', amount: 100 },
    { status: 'confirmed', method: 'cash', amount: '950.50' },
    { status: 'confirmed', method: 'card', amount: 200 },
    { status: 'failed', method: 'cash', amount: 500 },
  ]), { pendingCount: 1, confirmedCount: 2, confirmedCashTotal: 950.5 })
})

test('does not turn malformed amounts or a malformed payload into revenue', () => {
  assert.deepEqual(getPaymentSummary([
    { status: 'confirmed', method: 'cash', amount: 'not-money' },
    { status: 'confirmed', method: 'cash', amount: -20 },
  ]), { pendingCount: 0, confirmedCount: 2, confirmedCashTotal: 0 })
  assert.deepEqual(getPaymentSummary({ payments: [] }), { pendingCount: 0, confirmedCount: 0, confirmedCashTotal: 0 })
})
