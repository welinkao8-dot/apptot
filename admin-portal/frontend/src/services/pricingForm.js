const MONEY_FIELDS = [
    ['base_fare', 'Base (Kz)'],
    ['price_per_km', 'Preço por km (Kz)'],
    ['price_per_min', 'Preço por minuto (Kz)'],
    ['min_fare', 'Tarifa mínima (Kz)'],
    ['platform_fee_value', 'Valor da taxa'],
]

const DECIMAL_10_2_MAX = 99999999.99

function moneyInCents(value) {
    const text = String(value ?? '').trim()
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null
    const [whole, fraction = ''] = text.split('.')
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

function requiredRoutingMode(vehicleCategory) {
    if (/moto|motorcycle|scooter|bike/i.test(vehicleCategory || '')) return 'scooter'
    if (/truck|caminh|camião|camiao|van/i.test(vehicleCategory || '')) return 'truck'
    if (/car|autom[oó]vel/i.test(vehicleCategory || '')) return 'car'
    return null
}

export function normalizePricingService(service) {
    const normalized = { ...service }

    const expectedRoutingMode = requiredRoutingMode(service.vehicle_category)
    if (expectedRoutingMode && service.routing_mode !== expectedRoutingMode) {
        throw new Error(`Modo de rota incompatível com a categoria selecionada. Use ${expectedRoutingMode}.`)
    }

    for (const [field, label] of MONEY_FIELDS) {
        const rawValue = service[field]
        const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue
        const decimalText = String(value ?? '')

        if (!/^\d+(?:\.\d{1,2})?$/.test(decimalText)) {
            throw new Error(`${label}: informe um valor não negativo com até duas casas decimais.`)
        }

        const amount = Number(decimalText)
        if (!Number.isFinite(amount) || amount > DECIMAL_10_2_MAX) {
            throw new Error(`${label}: o valor excede o limite suportado pelo banco de dados.`)
        }

        normalized[field] = amount
    }

    if (service.platform_fee_type === 'percentage' && normalized.platform_fee_value > 100) {
        throw new Error('Taxa percentual não pode exceder 100%.')
    }

    return normalized
}

export function isPricingServiceDirty(original, current) {
    if (!original) return true
    if (!current) return false

    const keys = new Set([...Object.keys(original), ...Object.keys(current)])
    for (const key of keys) {
        const before = original[key]
        const after = current[key]
        if (MONEY_FIELDS.some(([field]) => field === key)) {
            if (String(before ?? '').trim() !== String(after ?? '').trim()) {
                const beforeCents = moneyInCents(before)
                const afterCents = moneyInCents(after)
                if (beforeCents !== null && afterCents !== null && beforeCents === afterCents) continue
                return true
            }
        } else if (before !== after) {
            return true
        }
    }
    return false
}
