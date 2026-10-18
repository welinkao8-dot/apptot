/* Formatadores partilhados.

   O painel formatava os mesmos valores de maneiras diferentes: o painel de
   gestão usava `Intl.NumberFormat('pt-AO')` ("2 022") e as listas de corridas,
   clientes e configurações usavam `.toLocaleString()` sem locale, que segue o
   idioma do navegador — em en-US dá "2,022". A mesma corrida aparecia com dois
   números diferentes em dois ecrãs. Aqui há um só formatador.
*/

const numberAO = new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 })
const numberAOExact = new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compactAO = new Intl.NumberFormat('pt-AO', { notation: 'compact', maximumFractionDigits: 1 })

const toNumber = value => (Number.isFinite(Number(value)) ? Number(value) : 0)

export const formatNumber = value => numberAO.format(toNumber(value))

/* A convenção do produto é o prefixo "Kz". A opção nativa de moeda do Intl
   devolve "2 022 Kz" (sufixo) para AOA, por isso o prefixo é explícito. */
export const formatKz = value => `Kz ${formatNumber(value)}`

export const formatKzExact = value => `Kz ${numberAOExact.format(toNumber(value))}`

export const formatCompactNumber = value => compactAO.format(toNumber(value))

export function formatDayShort(value) {
    if (!value) return ''
    const date = new Date(`${value}T12:00:00`)
    if (Number.isNaN(date.getTime())) return String(value)
    return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit' }).format(date)
}

export function formatDateTime(value, fallback = 'Sem data registada') {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return new Intl.DateTimeFormat('pt-AO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

export function formatDate(value, fallback = 'Sem data registada') {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return new Intl.DateTimeFormat('pt-AO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(date)
}

export function formatClock(value, fallback = 'Sem registo') {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return new Intl.DateTimeFormat('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
}

/* Telefones angolanos chegam sem formatação, com 9 e 12 dígitos misturados.
   Agrupar torna a coluna legível e revela se um número está incompleto. */
export function formatPhone(value) {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return 'Sem telefone'
    if (digits.length === 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    if (digits.length === 12) return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
    return digits
}

const PAYMENT_METHODS = {
    cash: 'Numerário (Cash)',
    multicaixa_express: 'Multicaixa Express',
    mcx: 'Multicaixa Express',
    wallet: 'Carteira Digital',
    card: 'Cartão de Pagamento',
    bank_transfer: 'Transferência Bancária',
}

export function formatPaymentMethod(method, fallback = 'Não especificado') {
    if (!method) return fallback
    const key = String(method).trim().toLowerCase()
    return PAYMENT_METHODS[key] || key.replace(/[_-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const SERVICE_TYPES = {
    ride: 'Corrida',
    delivery: 'Entrega',
    express: 'Serviço Expresso',
    standard: 'Padrão',
    moto: 'Moto Táxi',
    comfort: 'Conforto',
}

export function formatServiceType(serviceType, fallback = 'Moto Táxi') {
    if (!serviceType) return fallback
    const key = String(serviceType).trim().toLowerCase()
    return SERVICE_TYPES[key] || key.replace(/[_-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
