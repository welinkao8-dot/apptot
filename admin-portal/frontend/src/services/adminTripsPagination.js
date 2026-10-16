export function buildTripsQuery({ page, pageSize, status, search }) {
    return { page, limit: pageSize, status, search: search.trim() }
}

export function normalizeTripsPage(data) {
    if (!data || !Array.isArray(data.items)
        || !Number.isSafeInteger(data.total) || data.total < 0
        || !Number.isSafeInteger(data.page) || data.page < 1
        || !Number.isSafeInteger(data.pageSize) || data.pageSize < 1) {
        throw new Error('Resposta paginada de viagens inválida.')
    }
    return {
        items: data.items,
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
    }
}
