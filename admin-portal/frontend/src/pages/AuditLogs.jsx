import { useState, useEffect } from 'react'
import {
    ArrowLeft,
    Shield,
    Search,
    Filter,
    ChevronDown,
    ChevronRight,
    User,
    Bike,
    DollarSign,
    Trash2,
    CheckCircle,
    XCircle,
    RefreshCw,
    Clock
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const ACTION_COLORS = {
    'UPDATE_STATUS_ACTIVE': { bg: '#dcfce7', text: '#15803d', label: 'Ativado' },
    'UPDATE_STATUS_SUSPENDED': { bg: '#fee2e2', text: '#dc2626', label: 'Suspenso' },
    'UPDATE_STATUS_PENDING': { bg: '#fef9c3', text: '#a16207', label: 'Pendente' },
    'UPDATE_CLIENT_STATUS_ACTIVE': { bg: '#dcfce7', text: '#15803d', label: 'Cliente Ativado' },
    'UPDATE_CLIENT_STATUS_SUSPENDED': { bg: '#fee2e2', text: '#dc2626', label: 'Cliente Suspenso' },
    'CREATE_SERVICE': { bg: '#dbeafe', text: '#1d4ed8', label: 'Serviço Criado' },
    'UPDATE_PRICING': { bg: '#ede9fe', text: '#6d28d9', label: 'Tarifa Atualizada' },
    'DELETE_SERVICE': { bg: '#fee2e2', text: '#dc2626', label: 'Serviço Eliminado' },
}

const TARGET_ICONS = {
    driver: <Bike size={14} />,
    client: <User size={14} />,
    service_config: <DollarSign size={14} />,
}

function getActionMeta(action) {
    if (ACTION_COLORS[action]) return ACTION_COLORS[action]
    if (action.includes('ACTIVE')) return { bg: '#dcfce7', text: '#15803d', label: action }
    if (action.includes('SUSPEND') || action.includes('DELETE')) return { bg: '#fee2e2', text: '#dc2626', label: action }
    if (action.includes('CREATE')) return { bg: '#dbeafe', text: '#1d4ed8', label: action }
    if (action.includes('UPDATE')) return { bg: '#ede9fe', text: '#6d28d9', label: action }
    return { bg: '#f1f5f9', text: '#475569', label: action }
}

export default function AuditLogs({ onBack }) {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterAction, setFilterAction] = useState('all')
    const [filterTarget, setFilterTarget] = useState('all')
    const [expandedId, setExpandedId] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 15

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, filterAction, filterTarget])

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        try {
            setLoading(true)
            const res = await axios.get(`${API_URL}/admin/logs`)
            setLogs(Array.isArray(res.data) ? res.data : [])
        } catch (err) {
            toast.error('Erro ao carregar logs')
        } finally {
            setLoading(false)
        }
    }

    const uniqueActions = [...new Set(logs.map(l => l.action))]
    const uniqueTargets = [...new Set(logs.map(l => l.target))]

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            (log.target_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.profiles?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        const matchesAction = filterAction === 'all' || log.action === filterAction
        const matchesTarget = filterTarget === 'all' || log.target === filterTarget
        return matchesSearch && matchesAction && matchesTarget
    })
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    return (
        <div className="trips-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <button className="btn-back-square" onClick={onBack}><ArrowLeft size={20} /></button>
                    <div className="title-area">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield size={22} style={{ color: '#e91e63' }} /> Audit Logs
                        </h2>
                        <p>{filteredLogs.length} registos encontrados</p>
                    </div>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="search-bar-premium">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Pesquisar ação, ID ou admin..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                        style={{
                            padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                            background: '#fff', fontSize: 13, color: '#334155', cursor: 'pointer'
                        }}
                    >
                        <option value="all">Todas as ações</option>
                        {uniqueActions.map(a => <option key={a} value={a}>{getActionMeta(a).label}</option>)}
                    </select>
                    <select
                        value={filterTarget}
                        onChange={e => setFilterTarget(e.target.value)}
                        style={{
                            padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                            background: '#fff', fontSize: 13, color: '#334155', cursor: 'pointer'
                        }}
                    >
                        <option value="all">Todos os alvos</option>
                        {uniqueTargets.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={fetchLogs} style={{
                        padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                        background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 13, color: '#334155'
                    }}>
                        <RefreshCw size={14} /> Atualizar
                    </button>
                </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loading ? (
                    [1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{
                            background: '#fff', borderRadius: 14, padding: '18px 24px',
                            border: '1.5px solid #f1f5f9', animation: 'pulse 1.5s infinite'
                        }}>
                            <div style={{ height: 16, background: '#f1f5f9', borderRadius: 6, width: '60%' }} />
                        </div>
                    ))
                ) : filteredLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                        <Shield size={56} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                        <p>Nenhum log encontrado.</p>
                    </div>
                ) : (
                    paginatedLogs.map(log => {
                        const meta = getActionMeta(log.action)
                        const isExpanded = expandedId === log.id
                        const hasDetails = log.details && Object.keys(log.details).length > 0

                        return (
                            <div key={log.id} style={{
                                background: '#fff', borderRadius: 14, border: '1.5px solid #f1f5f9',
                                overflow: 'hidden', transition: 'box-shadow 0.2s',
                            }}>
                                <div
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                                        cursor: hasDetails ? 'pointer' : 'default'
                                    }}
                                    onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                                >
                                    {/* Action pill */}
                                    <span style={{
                                        background: meta.bg, color: meta.text, padding: '4px 12px',
                                        borderRadius: 20, fontSize: 11, fontWeight: 700,
                                        whiteSpace: 'nowrap', flexShrink: 0
                                    }}>{meta.label}</span>

                                    {/* Target */}
                                    <span style={{
                                        display: 'flex', alignItems: 'center', gap: 5,
                                        fontSize: 12, color: '#64748b', flexShrink: 0
                                    }}>
                                        {TARGET_ICONS[log.target] || <Shield size={14} />}
                                        {log.target}
                                    </span>

                                    {/* Target ID */}
                                    <span style={{
                                        fontFamily: 'monospace', fontSize: 11, color: '#94a3b8',
                                        background: '#f8fafc', padding: '2px 8px', borderRadius: 6,
                                        maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                    }}>
                                        {log.target_id ? `#${log.target_id.substring(0, 8).toUpperCase()}` : '—'}
                                    </span>

                                    {/* Admin */}
                                    <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
                                        <User size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        {log.profiles?.full_name || 'Sistema'}
                                    </span>

                                    {/* Date */}
                                    <span style={{
                                        fontSize: 11, color: '#cbd5e1', marginLeft: 'auto',
                                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0
                                    }}>
                                        <Clock size={12} />
                                        {new Date(log.created_at).toLocaleString('pt-AO', {
                                            day: '2-digit', month: '2-digit', year: '2-digit',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>

                                    {hasDetails && (
                                        <span style={{ color: '#cbd5e1', flexShrink: 0 }}>
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </span>
                                    )}
                                </div>

                                {isExpanded && hasDetails && (
                                    <div style={{
                                        borderTop: '1.5px solid #f1f5f9', padding: '14px 24px',
                                        background: '#fafbfc'
                                    }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Detalhes da Ação</p>
                                        <pre style={{
                                            fontSize: 12, color: '#334155', background: '#f1f5f9',
                                            padding: '12px 16px', borderRadius: 8, overflow: 'auto',
                                            margin: 0, maxHeight: 200
                                        }}>
                                            {JSON.stringify(log.details, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )
                    })
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
        </div>
    )
}
