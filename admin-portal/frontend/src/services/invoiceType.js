/* Descreve os tipos de fatura e recibo em português.
   
   A API e a base de dados persistem enums técnicos em inglês ou snake_case
   como 'ride_receipt', 'delivery_receipt' ou 'ride'. O painel administrativo
   nunca deve expor esses nomes crus ao utilizador: cada tipo ganha uma designação
   oficial em português, cores com a identidade visual apropriada e fallback seguro.
*/

const EXACT_TYPES = {
    'ride_receipt': { label: 'Recibo de Corrida', tone: 'ride', bg: '#fce4ec', text: '#c2185b' },
    'ride': { label: 'Corrida', tone: 'ride', bg: '#fce4ec', text: '#c2185b' },
    'delivery_receipt': { label: 'Recibo de Entrega', tone: 'delivery', bg: '#d1fae5', text: '#065f46' },
    'delivery': { label: 'Entrega', tone: 'delivery', bg: '#d1fae5', text: '#065f46' },
    'client': { label: 'Cliente', tone: 'client', bg: '#ede9fe', text: '#5b21b6' },
    'driver': { label: 'Motorista', tone: 'driver', bg: '#fef3c7', text: '#92400e' },
    'topup': { label: 'Carregamento', tone: 'topup', bg: '#e0f2fe', text: '#0369a1' },
    'wallet': { label: 'Carteira Digital', tone: 'wallet', bg: '#e0e7ff', text: '#4338ca' },
    'subscription': { label: 'Assinatura', tone: 'subscription', bg: '#f3e8ff', text: '#7e22ce' },
    'penalty': { label: 'Penalização', tone: 'penalty', bg: '#fee2e2', text: '#b91c1c' },
    'fee': { label: 'Taxa de Serviço', tone: 'fee', bg: '#ffedd5', text: '#c2410c' },
    'manual': { label: 'Fatura Manual', tone: 'manual', bg: '#f1f5f9', text: '#475569' },
}

const normalize = type => String(type || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')

export function describeInvoiceType(type) {
    const raw = String(type || '').trim().toLowerCase()
    if (!raw) {
        return { label: 'Geral', tone: 'neutral', bg: '#f1f5f9', text: '#475569' }
    }

    if (EXACT_TYPES[raw]) {
        return EXACT_TYPES[raw]
    }

    const normalized = normalize(raw)
    if (EXACT_TYPES[normalized.replace(/\s+/g, '_')]) {
        return EXACT_TYPES[normalized.replace(/\s+/g, '_')]
    }

    // Heurísticas amigáveis em português
    if (normalized.includes('ride') && normalized.includes('receipt')) {
        return { label: 'Recibo de Corrida', tone: 'ride', bg: '#fce4ec', text: '#c2185b' }
    }
    if (normalized.includes('delivery') && normalized.includes('receipt')) {
        return { label: 'Recibo de Entrega', tone: 'delivery', bg: '#d1fae5', text: '#065f46' }
    }
    if (normalized.includes('receipt') || normalized.includes('recibo')) {
        return { label: 'Recibo', tone: 'info', bg: '#fce4ec', text: '#c2185b' }
    }
    if (normalized.includes('ride') || normalized.includes('corrida') || normalized.includes('viagem')) {
        return { label: 'Corrida', tone: 'ride', bg: '#fce4ec', text: '#c2185b' }
    }
    if (normalized.includes('delivery') || normalized.includes('entrega')) {
        return { label: 'Entrega', tone: 'delivery', bg: '#d1fae5', text: '#065f46' }
    }
    if (normalized.includes('topup') || normalized.includes('recarga')) {
        return { label: 'Carregamento', tone: 'topup', bg: '#e0f2fe', text: '#0369a1' }
    }

    // Capitalização limpa sem underscores
    const humanized = normalized
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

    return {
        label: humanized || 'Fatura Geral',
        tone: 'neutral',
        bg: '#f1f5f9',
        text: '#475569'
    }
}

export function formatInvoiceType(type) {
    return describeInvoiceType(type).label
}

export default describeInvoiceType
