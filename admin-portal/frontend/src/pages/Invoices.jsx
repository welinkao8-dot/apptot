import { useState, useEffect } from 'react'
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
    Receipt
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const TYPE_META = {
    'ride': { label: 'Corrida', bg: '#dbeafe', text: '#1d4ed8' },
    'delivery': { label: 'Entrega', bg: '#d1fae5', text: '#065f46' },
    'client': { label: 'Cliente', bg: '#ede9fe', text: '#5b21b6' },
    'driver': { label: 'Motorista', bg: '#fef3c7', text: '#92400e' },
}

function getTypeMeta(type) {
    return TYPE_META[type] || { label: type || 'Geral', bg: '#f1f5f9', text: '#475569' }
}

export default function Invoices({ onBack }) {
    const [invoices, setInvoices] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [selectedInvoice, setSelectedInvoice] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, filterType])

    useEffect(() => {
        fetchInvoices()
    }, [])

    const fetchInvoices = async () => {
        try {
            setLoading(true)
            const res = await axios.get(`${API_URL}/admin/invoices`)
            setInvoices(Array.isArray(res.data) ? res.data : [])
        } catch (err) {
            toast.error('Erro ao carregar faturas')
            setInvoices([])
        } finally {
            setLoading(false)
        }
    }

    const filteredInvoices = invoices.filter(inv => {
        const name = inv.profiles?.full_name?.toLowerCase() || ''
        const id = inv.id?.toLowerCase() || ''
        const matchesSearch = name.includes(searchTerm.toLowerCase()) || id.includes(searchTerm.toLowerCase())
        const matchesType = filterType === 'all' || inv.invoice_type === filterType
        return matchesSearch && matchesType
    })

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
    const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    const uniqueTypes = [...new Set(invoices.map(i => i.invoice_type).filter(Boolean))]

    // KPIs
    const totalAmount = invoices.reduce((s, i) => s + Number(i.amount || 0), 0)
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0)
    const monthlyAmount = invoices
        .filter(i => new Date(i.created_at) >= thisMonth)
        .reduce((s, i) => s + Number(i.amount || 0), 0)
    const monthlyCount = invoices.filter(i => new Date(i.created_at) >= thisMonth).length

    return (
        <div className="trips-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <button className="btn-back-square" onClick={onBack}><ArrowLeft size={20} /></button>
                    <div className="title-area">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Receipt size={22} style={{ color: '#e91e63' }} /> Faturas
                        </h2>
                        <p>{filteredInvoices.length} faturas encontradas</p>
                    </div>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="search-bar-premium">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Pesquisar cliente ou ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        style={{
                            padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                            background: '#fff', fontSize: 13, color: '#334155', cursor: 'pointer'
                        }}
                    >
                        <option value="all">Todos os tipos</option>
                        {uniqueTypes.map(t => <option key={t} value={t}>{getTypeMeta(t).label}</option>)}
                    </select>
                    <button onClick={fetchInvoices} style={{
                        padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                        background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 13, color: '#334155'
                    }}>
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
                    {[
                        { label: 'Total Faturado', value: `Kz ${totalAmount.toLocaleString()}`, icon: <DollarSign size={22} />, color: '#e91e63' },
                        { label: 'Faturas Este Mês', value: monthlyCount, icon: <Calendar size={22} />, color: '#3b82f6' },
                        { label: 'Volume Mensal', value: `Kz ${monthlyAmount.toLocaleString()}`, icon: <TrendingUp size={22} />, color: '#10b981' },
                    ].map((kpi, i) => (
                        <div key={i} style={{
                            background: '#fff', borderRadius: 16, padding: '20px 24px',
                            border: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 16
                        }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 14, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: `${kpi.color}18`, color: kpi.color, flexShrink: 0
                            }}>{kpi.icon}</div>
                            <div>
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{kpi.label}</p>
                                <p style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>{kpi.value}</p>
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
                ) : filteredInvoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                        <FileText size={56} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                        <p>Nenhuma fatura encontrada.</p>
                        <p style={{ fontSize: 13 }}>As faturas são geradas automaticamente ao concluir corridas.</p>
                    </div>
                ) : (
                    <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f1f5f9', overflow: 'hidden' }}>
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
                                        Kz {Number(inv.amount).toLocaleString()}
                                    </span>
                                    <span style={{ display: 'inline-flex' }}>
                                        <span style={{
                                            background: meta.bg, color: meta.text,
                                            padding: '3px 10px', borderRadius: 20,
                                            fontSize: 11, fontWeight: 700
                                        }}>{meta.label}</span>
                                    </span>
                                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                                        {new Date(inv.created_at).toLocaleDateString('pt-AO')}
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

            {/* Detail modal */}
            {selectedInvoice && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, backdropFilter: 'blur(4px)'
                    }}
                    onClick={() => setSelectedInvoice(null)}
                >
                    <div
                        style={{
                            background: '#fff', borderRadius: 24, padding: 32,
                            width: 420, maxWidth: '90vw', boxShadow: '0 32px 80px rgba(0,0,0,0.2)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: 20, background: '#e91e6318',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 12px', color: '#e91e63'
                            }}>
                                <FileText size={32} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Fatura #{selectedInvoice.id.substring(0, 8).toUpperCase()}</h3>
                        </div>

                        {[
                            ['Cliente', selectedInvoice.profiles?.full_name || 'Desconhecido'],
                            ['Montante', `Kz ${Number(selectedInvoice.amount).toLocaleString()}`],
                            ['Tipo', getTypeMeta(selectedInvoice.invoice_type).label],
                            ['Data', new Date(selectedInvoice.created_at).toLocaleString('pt-AO')],
                            ['Corrida', selectedInvoice.trips?.id ? `#${selectedInvoice.trips.id.substring(0, 8).toUpperCase()}` : '—'],
                            ['Origem', selectedInvoice.trips?.origin_address || '—'],
                            ['Destino', selectedInvoice.trips?.dest_address || '—'],
                        ].map(([label, value]) => (
                            <div key={label} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14
                            }}>
                                <span style={{ color: '#64748b', fontWeight: 500 }}>{label}</span>
                                <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right', maxWidth: 200 }}>{value}</span>
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                            {selectedInvoice.pdf_url ? (
                                <a
                                    href={selectedInvoice.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: 12, textAlign: 'center',
                                        background: 'linear-gradient(135deg, #e91e63, #c2185b)',
                                        color: '#fff', fontWeight: 700, textDecoration: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                    }}
                                >
                                    <Download size={16} /> Baixar PDF
                                </a>
                            ) : null}
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12,
                                    background: '#f1f5f9', border: 'none', color: '#334155',
                                    fontWeight: 600, cursor: 'pointer', fontSize: 14
                                }}
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
