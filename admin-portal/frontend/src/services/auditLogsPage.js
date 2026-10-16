export function buildAuditLogsQuery({ page, pageSize, action, target, search }) {
    const query = {
        page,
        limit: pageSize,
    }
    for (const [key, value] of Object.entries({ action, target, search })) {
        const normalized = value.trim()
        if (normalized) query[key] = normalized
    }
    return query
}

export function normalizeAuditLogsPage(data) {
    if (!data || !Array.isArray(data.items)
        || !Number.isSafeInteger(data.total) || data.total < 0
        || !Number.isSafeInteger(data.page) || data.page < 1
        || !Number.isSafeInteger(data.pageSize) || data.pageSize < 1) {
        throw new Error('Resposta paginada de auditoria inválida.')
    }
    return { items: data.items, total: data.total, page: data.page, pageSize: data.pageSize }
}

export function createAuditLogRequestSequence() {
    let sequence = 0
    return {
        begin: () => ++sequence,
        isCurrent: request => request === sequence,
        invalidate: () => { sequence += 1 },
    }
}

export async function loadAuditLogsPage(api, query) {
    const { data } = await api.get('/admin/logs', { params: query })
    return normalizeAuditLogsPage(data)
}
