import { normalizeTripsPage } from './adminTripsPagination.js'

function validateTripItems(items, clientId) {
    if (!items.every((trip) => trip && typeof trip === 'object'
        && !Array.isArray(trip)
        && typeof trip.id === 'string'
        && typeof trip.client_id === 'string')) {
        throw new Error('Resposta paginada de viagens inválida.')
    }
    if (items.some((trip) => trip.client_id !== clientId)) {
        throw new Error('A resposta contém viagens fora do cliente selecionado.')
    }
}

export async function fetchClientTripsPage(fetchPage, clientId, pageNumber, pageSize) {
    const data = await fetchPage(pageNumber, pageSize)
    const page = normalizeTripsPage(data)
    const expectedItemCount = Math.max(0, Math.min(pageSize, page.total - (pageNumber - 1) * pageSize))

    if (page.page !== pageNumber
        || page.pageSize !== pageSize
        || pageNumber > Math.ceil(page.total / pageSize) && page.total > 0
        || page.items.length !== expectedItemCount) {
        throw new Error('Resposta paginada de viagens inconsistente.')
    }
    validateTripItems(page.items, clientId)

    if (!data.summary || !Number.isFinite(data.summary.confirmedSpend) || data.summary.confirmedSpend < 0) {
        throw new Error('Resumo inválido para viagens.')
    }

    return {
        ...page,
        summary: { confirmedSpend: data.summary.confirmedSpend },
    }
}
