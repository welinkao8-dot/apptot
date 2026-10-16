import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDriversQuery, createRequestSequence, loadDriversPage, normalizeAdminTripsResponse, normalizeDriversPage, normalizeDriverTripsPage } from './adminDriversList.js'

test('normalizes array and paginated admin trip responses for driver history', () => {
    const trips = [{ id: 'trip-1', driver_id: 'driver-1' }]
    assert.deepEqual(normalizeAdminTripsResponse(trips), trips)
    assert.deepEqual(normalizeAdminTripsResponse({ items: trips, total: 37, page: 1, pageSize: 20 }), trips)
    assert.throws(() => normalizeAdminTripsResponse({ total: 37 }), /inválida/)
})

test('normalizes owner-scoped driver trip history and completed earnings summary', () => {
    const trips = [{ id: 'trip-1', driver_id: 'driver-1' }]
    assert.deepEqual(normalizeDriverTripsPage({
        items: trips, total: 31, page: 1, pageSize: 20, summary: { completedEarnings: 1250 },
    }), { items: trips, total: 31, page: 1, pageSize: 20, summary: { completedEarnings: 1250 } })
    assert.throws(() => normalizeDriverTripsPage({ items: trips, total: 31, page: 1, pageSize: 20 }), /inválida/)
})

test('builds the server query for the current page, status and trimmed search', () => {
    assert.deepEqual(buildDriversQuery({ page: 2, pageSize: 20, status: 'active', search: ' Ana ' }), {
        page: 2, limit: 20, status: 'active', search: 'Ana',
    })
})

test('validates the paginated driver response and rows', () => {
    const page = { items: [{ id: 'driver-1', status: 'active' }], total: 21, page: 2, pageSize: 10 }
    assert.deepEqual(normalizeDriversPage(page), page)
    assert.throws(() => normalizeDriversPage([{ id: 'driver-1', status: 'active' }]), /inválida/)
    assert.throws(() => normalizeDriversPage({ ...page, items: [{ id: 'driver-1' }] }), /inválida/)
    assert.throws(() => normalizeDriversPage({ ...page, total: -1 }), /inválida/)
})

test('lets only the latest driver request publish its result', () => {
    const requests = createRequestSequence()
    const older = requests.begin()
    const latest = requests.begin()
    assert.equal(requests.isCurrent(older), false)
    assert.equal(requests.isCurrent(latest), true)
    requests.invalidate()
    assert.equal(requests.isCurrent(latest), false)
})

test('retries a failed driver page load and accepts the next valid response', async () => {
    const page = { items: [{ id: 'driver-1', status: 'active' }], total: 1, page: 1, pageSize: 20 }
    let attempts = 0
    const api = { get: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('temporary failure')
        return { data: page }
    } }
    await assert.rejects(loadDriversPage(api, { page: 1, limit: 20, status: 'all', search: '' }), /temporary failure/)
    assert.deepEqual(await loadDriversPage(api, { page: 1, limit: 20, status: 'all', search: '' }), page)
    assert.equal(attempts, 2)
})
