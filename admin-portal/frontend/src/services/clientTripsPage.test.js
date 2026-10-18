import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchClientTripsPage } from './clientTripsPage.js'

const validPage = {
    items: [{ id: 'trip-a', client_id: 'client-a', status: 'completed' }],
    total: 41,
    page: 3,
    pageSize: 20,
    summary: { confirmedSpend: 8400 },
}

test('requests and returns one validated page scoped to the selected client with full-history summary', async () => {
    const requests = []
    const result = await fetchClientTripsPage(async (...args) => {
        requests.push(args)
        return validPage
    }, 'client-a', 3, 20)

    assert.deepEqual(requests, [[3, 20]])
    assert.deepEqual(result, validPage)
})

test('rejects malformed successful responses instead of treating them as an empty history', async () => {
    await assert.rejects(
        fetchClientTripsPage(async () => ({ items: [] }), 'client-a', 1, 20),
        /inválida/,
    )
})

test('rejects rows that belong to a different client', async () => {
    await assert.rejects(
        fetchClientTripsPage(async () => ({ ...validPage, items: [{ id: 'trip-b', client_id: 'client-b', status: 'completed' }] }), 'client-a', 3, 20),
        /cliente selecionado/,
    )
})

test('rejects a response for a different page rather than showing mismatched history', async () => {
    await assert.rejects(
        fetchClientTripsPage(async () => ({ ...validPage, page: 2 }), 'client-a', 3, 20),
        /inconsistente/,
    )
})

test('rejects a page whose item count conflicts with the server total', async () => {
    await assert.rejects(
        fetchClientTripsPage(async () => ({ ...validPage, items: [] }), 'client-a', 3, 20),
        /inconsistente/,
    )
})

test('rejects a missing or invalid aggregate instead of presenting a false spend total', async () => {
    await assert.rejects(
        fetchClientTripsPage(async () => ({ ...validPage, summary: { confirmedSpend: '8400' } }), 'client-a', 3, 20),
        /Resumo inválido/,
    )
})
