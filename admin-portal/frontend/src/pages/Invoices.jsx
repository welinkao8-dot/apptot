import { useState, useEffect, useRef } from 'react'
import {
    ArrowLeft,
    FileText,
    Search,
    Download,
    ExternalLink,
    User,
    DollarSign,
    Calendar,
    TrendingUp,
    RefreshCw,
    Receipt,
    X,
} from 'lucide-react'
import adminApi from '../services/adminApi'
import toast from 'react-hot-toast'
import { buildInvoicesQuery, buildPaymentsQuery, createRequestSequence, loadFinancePage, normalizeInvoicesPage, normalizePaymentsPage } from '../services/adminFinancePagination'
import { describeInvoiceType } from '../services/invoiceType'
import { formatDate, formatDateTime, formatKz, formatPaymentMethod } from '../services/format'

function getTypeMeta(type) {
    return describeInvoiceType(type)
}


export default function Invoices({ onBack }) {
    const [invoices, setInvoices] = useState([])
    const [totalInvoices, setTotalInvoices] = useState(0)
    const [invoiceSummary, setInvoiceSummary] = useState(null)
    const [paymentsSummary, setPaymentsSummary] = useState(null)
    const [paymentsLoading, setPaymentsLoading] = useState(true)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [selectedInvoice, setSelectedInvoice] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10
    const invoicesRequest = useRef(createRequestSequence())
    const paymentsRequest = useRef(createRequestSequence())

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, filterType])

    useEffect(() => {
        fetchInvoices()
        return () => invoicesRequest.current.invalidate()
    }, [currentPage, searchTerm, filterType])

    useEffect(() => {
        fetchPayments()
        return () => paymentsRequest.current.invalidate()
    }, [])

    const fetchInvoices = async () => {
        const requestId = invoicesRequest.current.begin()
        try {
            setLoading(true)
            setLoadError(false)
            const query = buildInvoicesQuery({ page: currentPage, pageSize: itemsPerPage, type: filterType, search: searchTerm })
            const page = await loadFinancePage(adminApi, '/admin/invoices', query, normalizeInvoicesPage)
            if (!invoicesRequest.current.isCurrent(requestId)) return
            setInvoices(page.items)
            setTotalInvoices(page.total)
            setInvoiceSummary(page.summary)
        } catch (err) {
            if (!invoicesRequest.current.isCurrent(requestId)) return
            console.error('Erro ao carregar faturas:', err)
            setLoadError(true)
            setInvoices([])
            setTotalInvoices(0)
            setInvoiceSummary(null)
        } finally {
            if (invoicesRequest.current.isCurrent(requestId)) setLoading(false)
        }
    }

    const fetchPayments = async () => {
        const requestId = paymentsRequest.current.begin()
        setPaymentsLoading(true)
        try {
            const query = buildPaymentsQuery({ page: 1, pageSize: 1, status: 'all', search: '' })
            const page = await loadFinancePage(adminApi, '/admin/payments', query, normalizePaymentsPage)
            if (!paymentsRequest.current.isCurrent(requestId)) return
            setPaymentsSummary(page.summary)
        } catch (error) {
            if (!paymentsRequest.current.isCurrent(requestId)) return
            console.error('Erro ao carregar o resumo de pagamentos:', error)
            toast.error('Não foi possível carregar o ledger de pagamentos')
            setPaymentsSummary(null)
        } finally {
            if (paymentsRequest.current.isCurrent(requestId)) setPaymentsLoading(false)
        }
    }

    const filteredInvoices = invoices
    const totalPages = Math.ceil(totalInvoices / itemsPerPage)
    const paginatedInvoices = invoices
    const uniqueTypes = invoiceSummary?.invoiceTypes || []

    useEffect(() => {
        if (currentPage > Math.max(totalPages, 1)) setCurrentPage(Math.max(totalPages, 1))
    }, [currentPage, totalPages])

    return (
        <div className="trips-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <div className="title-area">
                        <h2>Faturas</h2>
                        <p>{totalInvoices} faturas encontradas</p>
                    </div>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="tot-search">
                        <Search size={18} />
                        <input
                            type="text"
                            maxLength={120}
                            placeholder="Pesquisar cliente ou ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="filter-select-premium"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                    >
                        <option value="all">Todos os tipos</option>
                        {uniqueTypes.map(t => <option key={t} value={t}>{getTypeMeta(t).label}</option>)}
                    </select>
                    <button className="tot-btn tot-btn--primary tot-btn--icon" onClick={() => { fetchInvoices(); fetchPayments() }} disabled={loading} aria-label="Atualizar faturas e pagamentos" title="Atualizar">
                        <RefreshCw size={16} className={loading ? 'is-spinning' : ''} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* KPI Cards (Estilo do perfil de motoristas) */}
            {!loading && !loadError && invoiceSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 24 }}>
                    {[
                        { label: 'Valor em recibos emitidos', value: formatKz(invoiceSummary.receiptTotal), icon: <FileText size={22} /> },
                        { label: 'Recibos este mês', value: invoiceSummary.monthlyReceiptCount, icon: <Calendar size={22} /> },
                        { label: 'Cash confirmado', value: paymentsLoading ? '…' : paymentsSummary ? formatKz(paymentsSummary.confirmedCashTotal) : '—', icon: <DollarSign size={22} /> },
                        { label: 'Cash pendente', value: paymentsLoading ? '…' : paymentsSummary ? formatKz(paymentsSummary.cashPendingTotal) : '—', icon: <TrendingUp size={22} /> },
                    ].map((kpi, i) => (
                        <div
                            key={i}
                            style={{
                                background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)',
                                borderRadius: '24px',
                                padding: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                boxShadow: '0 8px 24px rgba(233,30,99,0.2)',
                                color: 'white'
                            }}
                        >
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {kpi.icon}
                            </div>
                            <div>
                                <span style={{
                                    display: 'block',
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    color: 'rgba(255,255,255,0.7)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {kpi.label}
                                </span>
                                <span style={{
                                    fontSize: '22px',
                                    fontWeight: '900',
                                    lineHeight: '1.1'
                                }}>
                                    {kpi.value}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Table */}
            <div style={{ marginTop: 24 }}>
                {loading ? (
                    [1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                            background: '#fff', borderRadius: 14, padding: '18px 24px', marginBottom: 8,
                            border: '1.5px solid #f1f5f9'
                        }}>
                            <div style={{ height: 16, background: '#f1f5f9', borderRadius: 6, width: '50%' }} />
                        </div>
                    ))
                ) : loadError ? (
                    <div role="alert" style={{ textAlign: 'center', padding: '80px 0', color: '#64748b' }}>
                        <p>Não foi possível carregar as faturas.</p>
                        <button type="button" onClick={fetchInvoices}>Tentar novamente</button>
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                        <FileText size={56} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                        <p>Nenhuma fatura encontrada.</p>
                        <p style={{ fontSize: 13 }}>As faturas são geradas automaticamente ao concluir corridas.</p>
                    </div>
                ) : (
                    <div className="invoice-table-wrap" style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f1f5f9', overflow: 'hidden' }}>
                        {/* Table header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr 120px',
                            padding: '12px 24px',
                            background: '#f8fafc',
                            borderBottom: '1.5px solid #f1f5f9',
                            fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1
                        }}>
                            <span>ID</span>
                            <span>Cliente</span>
                            <span>Montante</span>
                            <span>Tipo</span>
                            <span>Data</span>
                            <span>Ação</span>
                        </div>

                        {paginatedInvoices.map((inv, idx) => {
                            const meta = getTypeMeta(inv.invoice_type)
                            return (
                                <div
                                    key={inv.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr 120px',
                                        padding: '16px 24px',
                                        borderBottom: idx < paginatedInvoices.length - 1 ? '1px solid #f8fafc' : 'none',
                                        alignItems: 'center',
                                        transition: 'background 0.15s',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    onClick={() => setSelectedInvoice(inv)}
                                >
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                                        #{inv.id.substring(0, 8).toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <User size={14} style={{ color: '#94a3b8' }} />
                                        {inv.profiles?.full_name || 'Desconhecido'}
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: 800, color: '#e91e63' }}>
                                        {formatKz(inv.amount)}
                                    </span>
                                    <span style={{ display: 'inline-flex' }}>
                                        <span style={{
                                            background: meta.bg, color: meta.text,
                                            padding: '3px 10px', borderRadius: 20,
                                            fontSize: 11, fontWeight: 700
                                        }}>{meta.label}</span>
                                    </span>
                                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                                        {formatDate(inv.created_at)}
                                    </span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {inv.pdf_url ? (
                                            <a
                                                href={inv.pdf_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    padding: '6px 12px', borderRadius: 8, fontSize: 12,
                                                    background: '#e91e6318', color: '#e91e63', fontWeight: 600,
                                                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4
                                                }}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <ExternalLink size={12} /> PDF
                                            </a>
                                        ) : (
                                            <button
                                                style={{
                                                    padding: '6px 12px', borderRadius: 8, fontSize: 12,
                                                    background: '#f1f5f9', color: '#94a3b8', fontWeight: 600,
                                                    border: 'none', cursor: 'not-allowed'
                                                }}
                                            >
                                                Sem PDF
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
                {/* Pagination Controls */}
                {!loading && totalPages > 1 && (() => {
                    const pages = [];
                    if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                        pages.push(1);
                        if (currentPage > 3) pages.push('...');
                        const start = Math.max(2, currentPage - 1);
                        const end = Math.min(totalPages - 1, currentPage + 1);
                        for (let i = start; i <= end; i++) {
                            if (pages[pages.length - 1] !== i) pages.push(i);
                        }
                        if (currentPage < totalPages - 2) pages.push('...');
                        if (pages[pages.length - 1] !== totalPages) pages.push(totalPages);
                    }

                    return (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 }}>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                                    background: '#fff', color: currentPage === 1 ? '#cbd5e1' : '#64748b',
                                    fontWeight: 600, fontSize: 13, cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Anterior
                            </button>
                            {pages.map((page, idx) => {
                                if (page === '...') {
                                    return <span key={`dots-${idx}`} style={{ color: '#94a3b8', padding: '0 4px' }}>...</span>;
                                }
                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        style={{
                                            width: 36, height: 36, borderRadius: 8, border: 'none',
                                            background: currentPage === page ? 'linear-gradient(135deg, #e91e63, #c2185b)' : '#f1f5f9',
                                            color: currentPage === page ? '#fff' : '#64748b',
                                            fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                                    background: '#fff', color: currentPage === totalPages ? '#cbd5e1' : '#64748b',
                                    fontWeight: 600, fontSize: 13, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Seguinte
                            </button>
                        </div>
                    );
                })()}
            </div>

            {/* Detail modal with TOT Pink Identity */}
            {selectedInvoice && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setSelectedInvoice(null)}
                >
                    <div
                        className="relative w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-[0_25px_60px_-15px_rgba(233,30,99,0.22)] border border-pink-100 ring-1 ring-pink-500/15 animate-in zoom-in-95 duration-200"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Fatura ${selectedInvoice.id.substring(0, 8).toUpperCase()}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Branded pink gradient top bar */}
                        <div className="h-2 w-full bg-gradient-to-r from-[#E91E63] via-[#FF2E93] to-[#880E4F]" />

                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setSelectedInvoice(null)}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
                            aria-label="Fechar"
                        >
                            <X size={16} />
                        </button>

                        <div className="p-6 sm:p-8">
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-pink-50 text-[#E91E63] ring-4 ring-pink-100/60 flex items-center justify-center mx-auto mb-3 shadow-sm">
                                    <FileText size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">
                                    Fatura #{selectedInvoice.id.substring(0, 8).toUpperCase()}
                                </h3>
                                <span className="inline-block mt-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-pink-50 text-[#E91E63] border border-pink-200/60">
                                    {getTypeMeta(selectedInvoice.invoice_type).label}
                                </span>
                            </div>

                            <div className="space-y-1.5 divide-y divide-slate-100 text-xs">
                                {[
                                    ['Cliente', selectedInvoice.profiles?.full_name || 'Desconhecido'],
                                    ['Montante', formatKz(selectedInvoice.amount)],
                                    ['Tipo', getTypeMeta(selectedInvoice.invoice_type).label],
                                    ['Pagamento', selectedInvoice.trips?.trip_payment?.status === 'confirmed'
                                        ? `Confirmado · ${formatPaymentMethod(selectedInvoice.trips.trip_payment.method)}`
                                        : selectedInvoice.trips?.trip_payment?.status === 'pending'
                                            ? `Pendente · ${formatPaymentMethod(selectedInvoice.trips.trip_payment.method)}`
                                            : 'Sem registo de pagamento'],
                                    ['Data', formatDateTime(selectedInvoice.created_at)],
                                    ['Corrida', selectedInvoice.trips?.id ? `#${selectedInvoice.trips.id.substring(0, 8).toUpperCase()}` : '—'],
                                    ['Origem', selectedInvoice.trips?.origin_address || '—'],
                                    ['Destino', selectedInvoice.trips?.dest_address || '—'],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex justify-between items-center py-2 px-1">
                                        <span className="text-slate-500 font-medium">{label}</span>
                                        <span className="text-slate-900 font-semibold text-right max-w-[220px] truncate">{value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                                {selectedInvoice.pdf_url ? (
                                    <a
                                        href={selectedInvoice.pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-2.5 px-4 rounded-full bg-gradient-to-r from-[#E91E63] to-[#D81B60] text-white text-xs font-semibold shadow-md shadow-pink-500/25 hover:opacity-95 flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Download size={15} />
                                        <span>Baixar PDF</span>
                                    </a>
                                ) : (
                                    <span role="status" className="flex-1 py-2 text-center text-slate-400 text-xs">
                                        PDF indisponível
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectedInvoice(null)}
                                    className="flex-1 py-2.5 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
