import { useState, useEffect, useRef } from 'react'
import {
    ArrowLeft,
    Shield,
    Search,
    ChevronDown,
    ChevronRight,
    User,
    Bike,
    DollarSign,
    RefreshCw,
    Clock
} from 'lucide-react'
import adminApi from '../services/adminApi'
import { buildAuditLogsQuery, createAuditLogRequestSequence, loadAuditLogsPage } from '../services/auditLogsPage'
import { formatDateTime } from '../services/format'


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
    const safeAction = typeof action === 'string' ? action : ''
    if (ACTION_COLORS[safeAction]) return ACTION_COLORS[safeAction]
    if (safeAction.includes('ACTIVE')) return { bg: '#dcfce7', text: '#15803d', label: safeAction || 'Ação sem nome' }
    if (safeAction.includes('SUSPEND') || safeAction.includes('DELETE')) return { bg: '#fee2e2', text: '#dc2626', label: safeAction || 'Ação sem nome' }
    if (safeAction.includes('CREATE')) return { bg: '#dbeafe', text: '#1d4ed8', label: safeAction || 'Ação sem nome' }
    if (safeAction.includes('UPDATE')) return { bg: '#ede9fe', text: '#6d28d9', label: safeAction || 'Ação sem nome' }
    return { bg: '#f1f5f9', text: '#475569', label: safeAction || 'Ação sem nome' }
}

export default function AuditLogs({ onBack }) {
    const [logs, setLogs] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterAction, setFilterAction] = useState('')
    const [filterTarget, setFilterTarget] = useState('')
    const [expandedId, setExpandedId] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 15
    const [refreshVersion, setRefreshVersion] = useState(0)
    const requests = useRef(null)
    if (!requests.current) requests.current = createAuditLogRequestSequence()

    useEffect(() => {
        const request = requests.current.begin()
        const query = buildAuditLogsQuery({
            page: currentPage,
            pageSize: itemsPerPage,
            action: filterAction,
            target: filterTarget,
            search: searchTerm,
        })
        setLoading(true)
        setError(null)
        loadAuditLogsPage(adminApi, query).then(page => {
            if (!requests.current.isCurrent(request)) return
            setLogs(page.items)
            setTotal(page.total)
        }).catch(() => {
            if (requests.current.isCurrent(request)) setError('Não foi possível carregar os registos de auditoria.')
        }).finally(() => {
            if (requests.current.isCurrent(request)) setLoading(false)
        })
        return () => requests.current.invalidate()
    }, [currentPage, filterAction, filterTarget, searchTerm, refreshVersion])

    const resetFilters = (setter, value) => {
        setter(value)
        setCurrentPage(1)
    }
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage))
    return (
        <div className="trips-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <div className="title-area">
                        <h2>Registo de Auditoria</h2>
                        <p>{total} registos encontrados</p>
                    </div>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="tot-search">
                        <Search size={18} />
                        <input
                            type="text"
                            maxLength={120}
                            placeholder="Pesquisar ação, ID ou admin..."
                            value={searchTerm}
                            onChange={e => resetFilters(setSearchTerm, e.target.value)}
                        />
                    </div>
                    <input
                        className="tot-filter-input"
                        type="text"
                        maxLength={255}
                        placeholder="Filtrar ação"
                        value={filterAction}
                        onChange={e => resetFilters(setFilterAction, e.target.value)}
                    />
                    <input
                        className="tot-filter-input"
                        type="text"
                        maxLength={255}
                        placeholder="Filtrar alvo"
                        value={filterTarget}
                        onChange={e => resetFilters(setFilterTarget, e.target.value)}
                    />
                    <button className="tot-btn tot-btn--primary tot-btn--icon" onClick={() => setRefreshVersion(version => version + 1)} disabled={loading} aria-label="Atualizar registo de auditoria" title="Atualizar">
                        <RefreshCw size={16} className={loading ? 'is-spinning' : ''} aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {error && (
                    <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderRadius: 10, background: '#fff7ed', color: '#9a3412' }}>
                        <span>{error} {logs.length ? 'Os resultados apresentados são da última consulta bem-sucedida.' : ''}</span>
                        <button onClick={() => setRefreshVersion(version => version + 1)} style={{ border: 0, background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Tentar novamente</button>
                    </div>
                )}
                {loading && logs.length === 0 ? (
                    [1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{
                            background: '#fff', borderRadius: 14, padding: '18px 24px',
                            border: '1.5px solid #f1f5f9', animation: 'pulse 1.5s infinite'
                        }}>
                            <div style={{ height: 16, background: '#f1f5f9', borderRadius: 6, width: '60%' }} />
                        </div>
                    ))
                ) : logs.length === 0 && !loading ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                        <Shield size={56} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                        <p>Nenhum log encontrado.</p>
                    </div>
                ) : (
                    logs.map(log => {
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
                                        {formatDateTime(log.created_at)}
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
                {!loading && total > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 12 }}>
                        <button onClick={() => setCurrentPage(page => Math.max(page - 1, 1))} disabled={currentPage <= 1}>Anterior</button>
                        <span>Página {currentPage} de {totalPages}</span>
                        <button onClick={() => setCurrentPage(page => Math.min(page + 1, totalPages))} disabled={currentPage >= totalPages}>Seguinte</button>
                    </div>
                )}
            </div>
        </div>
    )
}
