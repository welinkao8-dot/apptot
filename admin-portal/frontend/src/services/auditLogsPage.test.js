import test from 'node:test'
import assert from 'node:assert/strict'
import {
    buildAuditLogsQuery,
    createAuditLogRequestSequence,
    loadAuditLogsPage,
    normalizeAuditLogsPage,
} from './auditLogsPage.js'

test('builds a trimmed server-side audit query', () => {
    assert.deepEqual(buildAuditLogsQuery({ page: 2, pageSize: 15, action: ' UPDATE ', target: ' driver ', search: ' Ana ' }), {
        page: 2, limit: 15, action: 'UPDATE', target: 'driver', search: 'Ana',
    })
})

test('omits empty optional audit filters from the initial query', () => {
    assert.deepEqual(buildAuditLogsQuery({ page: 1, pageSize: 15, action: ' ', target: '', search: '   ' }), {
        page: 1, limit: 15,
    })
})

test('normalizes the paged audit envelope and rejects invalid results', () => {
    assert.deepEqual(normalizeAuditLogsPage({ items: [{ id: 'log-a' }], total: 21, page: 2, pageSize: 15 }), {
        items: [{ id: 'log-a' }], total: 21, page: 2, pageSize: 15,
    })
    assert.throws(() => normalizeAuditLogsPage([{ id: 'log-a' }]), /inválida/)
    assert.throws(() => normalizeAuditLogsPage({ items: [], total: -1, page: 1, pageSize: 15 }), /inválida/)
})

test('only the current query may publish results', () => {
    const requests = createAuditLogRequestSequence()
    const older = requests.begin()
    const current = requests.begin()
    assert.equal(requests.isCurrent(older), false)
    assert.equal(requests.isCurrent(current), true)
    requests.invalidate()
    assert.equal(requests.isCurrent(current), false)
})

test('a failed page load rejects so the UI can retain its previous snapshot and retry', async () => {
    const page = { items: [], total: 0, page: 1, pageSize: 15 }
    let calls = 0
    const api = { get: async () => {
        calls += 1
        if (calls === 1) throw new Error('temporary failure')
        return { data: page }
    } }
    await assert.rejects(loadAuditLogsPage(api, { page: 1 }), /temporary failure/)
    assert.deepEqual(await loadAuditLogsPage(api, { page: 1 }), page)
    assert.equal(calls, 2)
})
