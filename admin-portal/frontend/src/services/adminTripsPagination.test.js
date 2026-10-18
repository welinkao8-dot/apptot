import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTripsQuery, normalizeTripsPage } from './adminTripsPagination.js'

test('builds the server query for the selected page, filter and search', () => {
    assert.deepEqual(buildTripsQuery({ page: 2, pageSize: 20, status: 'live', search: '  ana  ' }), {
        page: 2, limit: 20, status: 'live', search: 'ana',
    })
})

test('normalizes the explicit paged response', () => {
    assert.deepEqual(normalizeTripsPage({ items: [{ id: 'trip-1', status: 'completed' }], total: 41, page: 3, pageSize: 20 }), {
        items: [{ id: 'trip-1', status: 'completed' }], total: 41, page: 3, pageSize: 20,
    })
})

test('rejects malformed responses instead of presenting a false empty result', () => {
    assert.throws(() => normalizeTripsPage([{ id: 'trip-1', status: 'completed' }]), /inválida/)
    assert.throws(() => normalizeTripsPage({ items: [], total: -1, page: 1, pageSize: 20 }), /inválida/)
    assert.throws(() => normalizeTripsPage({ items: [], total: 1, page: 1.5, pageSize: 20 }), /inválida/)
    assert.throws(() => normalizeTripsPage({ items: [{ id: 'trip-1' }], total: 1, page: 1, pageSize: 20 }), /inválida/)
})
