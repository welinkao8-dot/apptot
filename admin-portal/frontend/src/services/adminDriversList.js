export function buildDriversQuery({ page, pageSize, status, search }) {
    return { page, limit: pageSize, status, search: search.trim() }
}

export function normalizeDriversPage(data) {
    if (!data || !Array.isArray(data.items) || data.items.some(driver =>
        !driver || typeof driver !== 'object' || typeof driver.id !== 'string' || typeof driver.status !== 'string'
    ) || !Number.isSafeInteger(data.total) || data.total < 0
        || !Number.isSafeInteger(data.page) || data.page < 1
        || !Number.isSafeInteger(data.pageSize) || data.pageSize < 1) {
        throw new Error('Resposta paginada de motoristas inválida.')
    }
    return { items: data.items, total: data.total, page: data.page, pageSize: data.pageSize }
}

export function normalizeDriverTripsPage(data) {
    const page = normalizeAdminTripsResponse(data)
    if (!Number.isSafeInteger(data.total) || data.total < 0
        || !Number.isSafeInteger(data.page) || data.page < 1
        || !Number.isSafeInteger(data.pageSize) || data.pageSize < 1
        || !data.summary || !Number.isFinite(data.summary.completedEarnings)) {
        throw new Error('Resposta paginada do histórico do motorista inválida.')
    }
    return { items: page, total: data.total, page: data.page, pageSize: data.pageSize, summary: data.summary }
}

export async function loadDriversPage(adminApi, query) {
    const response = await adminApi.get('/admin/drivers', { params: query })
    return normalizeDriversPage(response.data)
}

export function createRequestSequence() {
    let current = 0
    return {
        begin: () => ++current,
        isCurrent: requestId => requestId === current,
        invalidate: () => { current += 1 },
    }
}

export function normalizeAdminTripsResponse(data) {
    const trips = Array.isArray(data) ? data : data?.items
    if (!Array.isArray(trips) || trips.some(trip => !trip || typeof trip !== 'object')) {
        throw new Error('Resposta de corridas inválida.')
    }
    return trips
}

