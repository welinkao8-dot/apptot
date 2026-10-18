import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, RefreshCw, Wallet, CheckCircle2, Clock3, Search } from 'lucide-react'
import adminApi from '../services/adminApi'
import toast from 'react-hot-toast'
import { buildPaymentsQuery, createRequestSequence, formatSummaryValue, loadFinancePage, normalizePaymentsPage } from '../services/adminFinancePagination'
import { formatDateTime, formatKz, formatPaymentMethod } from '../services/format'


const STATUS = {
    pending: { label: 'Pendente', color: '#b45309', background: '#fef3c7' },
    confirmed: { label: 'Confirmado', color: '#047857', background: '#d1fae5' },
}

export default function Payments({ onBack }) {
    const [payments, setPayments] = useState([])
    const [totalPayments, setTotalPayments] = useState(0)
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(null)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 20
    const requests = useRef(createRequestSequence())

    const fetchPayments = useCallback(async () => {
        const requestId = requests.current.begin()
        try {
            setLoading(true)
            const query = buildPaymentsQuery({ page: currentPage, pageSize: itemsPerPage, status: statusFilter, search })
            const page = await loadFinancePage(adminApi, '/admin/payments', query, normalizePaymentsPage)
            if (!requests.current.isCurrent(requestId)) return
            setPayments(page.items)
            setTotalPayments(page.total)
            setSummary(page.summary)
            setLoadError(null)
        } catch (error) {
            if (!requests.current.isCurrent(requestId)) return
            setLoadError(error)
            toast.error('Não foi possível carregar a conciliação de pagamentos.')
        } finally { if (requests.current.isCurrent(requestId)) setLoading(false) }
    }, [currentPage, search, statusFilter])

    useEffect(() => {
        fetchPayments()
        const interval = setInterval(fetchPayments, 30000)
        return () => {
            clearInterval(interval)
            requests.current.invalidate()
        }
    }, [fetchPayments])

    useEffect(() => setCurrentPage(1), [search, statusFilter])
    const totalPages = Math.ceil(totalPayments / itemsPerPage)
    useEffect(() => {
        if (currentPage > Math.max(totalPages, 1)) setCurrentPage(Math.max(totalPages, 1))
    }, [currentPage, totalPages])
    const filtered = payments

    return (
        <div className="trips-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <div className="title-area"><h2>Conciliação de pagamentos</h2><p>Estado persistido das cobranças em numerário · atualização a cada 30 segundos</p></div>
                </div>
                <button className="tot-btn tot-btn--primary tot-btn--icon" onClick={fetchPayments} disabled={loading} aria-label="Atualizar pagamentos" title="Atualizar"><RefreshCw size={16} className={loading ? 'is-spinning' : ''} aria-hidden="true" /></button>
            </div>

            <div className="admin-stats-grid" style={{ marginTop: 24 }}>
                <div className="admin-stat-card"><div className="stat-icon amber"><Clock3 size={22} /></div><div className="stat-info"><span className="label">Pendentes</span><span className="value">{formatSummaryValue(summary, 'pendingCount', loading)}</span></div></div>
                <div className="admin-stat-card"><div className="stat-icon emerald"><CheckCircle2 size={22} /></div><div className="stat-info"><span className="label">Confirmados</span><span className="value">{formatSummaryValue(summary, 'confirmedCount', loading)}</span></div></div>
                <div className="admin-stat-card"><div className="stat-icon pink"><Wallet size={22} /></div><div className="stat-info"><span className="label">Cash confirmado</span><span className="value">{formatSummaryValue(summary, 'confirmedCashTotal', loading, formatKz)}</span></div></div>
            </div>

            <div className="header-actions" style={{ margin: '20px 0' }}>
                <div className="tot-search" style={{ maxWidth: 460 }}><Search size={18} /><input maxLength={120} value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por viagem, cliente ou motorista" /></div>
                <select className="filter-select-premium" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                    <option value="all">Todos os estados</option>
                    <option value="pending">Pendentes</option>
                    <option value="confirmed">Confirmados</option>
                </select>
                <span style={{ color: '#64748b', fontSize: 13 }}>{totalPayments} pagamentos encontrados</span>
            </div>

            <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                    <thead><tr>{['Viagem', 'Cliente', 'Motorista', 'Valor', 'Método', 'Estado', 'Confirmado por', 'Data da confirmação'].map(label => <th key={label} style={{ textAlign: 'left', padding: 14, color: '#64748b', fontSize: 12 }}>{label}</th>)}</tr></thead>
                    <tbody>
                        {filtered.map(payment => {
                            const status = STATUS[payment.status] || { label: payment.status, color: '#475569', background: '#f1f5f9' }
                            return <tr key={payment.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                <td style={{ padding: 14 }}>#{String(payment.trips?.id || payment.trip_id || '').slice(0, 8).toUpperCase() || '—'}</td>
                                <td style={{ padding: 14 }}>{payment.trips?.profiles_trips_client_idToprofiles?.full_name || '—'}</td>
                                <td style={{ padding: 14 }}>{payment.trips?.profiles_trips_driver_idToprofiles?.full_name || '—'}</td>
                                <td style={{ padding: 14, fontWeight: 700 }}>{Number.isFinite(Number(payment.amount)) ? formatKz(payment.amount) : '—'}</td>
                                <td style={{ padding: 14 }}>{formatPaymentMethod(payment.method)}</td>
                                <td style={{ padding: 14 }}><span style={{ color: status.color, background: status.background, padding: '5px 9px', borderRadius: 20 }}>{status.label}</span></td>
                                <td style={{ padding: 14 }}>{payment.profiles?.full_name || '—'}</td>
                                <td style={{ padding: 14 }}>{payment.confirmed_at ? formatDateTime(payment.confirmed_at) : '—'}</td>
                            </tr>
                        })}
                        {!loading && loadError && <tr><td colSpan="8" style={{ padding: 28, textAlign: 'center', color: '#b91c1c' }}>
                            Não foi possível atualizar. {payments.length ? 'A mostrar os últimos dados carregados.' : 'Não há dados anteriores para mostrar.'}
                            <button type="button" onClick={fetchPayments} style={{ marginLeft: 12 }}>Tentar novamente</button>
                        </td></tr>}
                        {!loading && !loadError && filtered.length === 0 && <tr><td colSpan="8" style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>Nenhum registo de pagamento encontrado.</td></tr>}
                        {loading && <tr><td colSpan="8" style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>A carregar pagamentos…</td></tr>}
                    </tbody>
                </table>
            </div>
            {!loading && totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, margin: '24px 0 12px' }}>
                    <button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1}>Anterior</button>
                    <span style={{ color: '#64748b', fontSize: 13 }}>Página {currentPage} de {totalPages}</span>
                    <button type="button" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Seguinte</button>
                </div>
            )}
        </div>
    )
}
