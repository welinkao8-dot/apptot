import { useState, useEffect } from 'react'
import {
    Search,
    Calendar,
    ArrowLeft,
    MapPin,
    Clock,
    Navigation,
    User,
    Bike,
    Car,
    Filter,
    ChevronRight,
    Download,
    FileText,
    Activity,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    RefreshCw
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000'

const STATUS_META = {
    requested:  { label: 'Aguardando',  color: '#f59e0b', bg: '#fef3c7', icon: <AlertCircle size={13} />, live: true },
    accepted:   { label: 'Aceite',      color: '#3b82f6', bg: '#dbeafe', icon: <CheckCircle2 size={13} />, live: true },
    arrived:    { label: 'Chegou',      color: '#8b5cf6', bg: '#ede9fe', icon: <MapPin size={13} />, live: true },
    ongoing:    { label: 'Em Curso',    color: '#10b981', bg: '#d1fae5', icon: <Navigation size={13} />, live: true },
    completed:  { label: 'Concluída',   color: '#64748b', bg: '#f1f5f9', icon: <CheckCircle2 size={13} />, live: false },
    cancelled:  { label: 'Cancelada',   color: '#ef4444', bg: '#fee2e2', icon: <XCircle size={13} />, live: false },
}

const TABS = [
    { key: 'all', label: 'Todas' },
    { key: 'live', label: 'Ativas', live: true },
    { key: 'completed', label: 'Concluídas' },
    { key: 'cancelled', label: 'Canceladas' },
]

export default function Trips({ onBack }) {
    const [trips, setTrips] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedTrip, setSelectedTrip] = useState(null)
    const [liveCount, setLiveCount] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 8 // trips cards are large, so 8 is a good size

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, activeTab])

    useEffect(() => {
        fetchTrips()

        // WebSocket for real-time updates
        const socket = io(SOCKET_URL)
        socket.on('trip_update', () => fetchTrips())
        socket.on('dashboard_update', () => fetchTrips())
        return () => socket.disconnect()
    }, [])

    const fetchTrips = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/trips`)
            const data = Array.isArray(res.data) ? res.data : []
            setTrips(data)
            setLiveCount(data.filter(t => STATUS_META[t.status]?.live).length)
        } catch (error) {
            console.error('Error fetching trips:', error)
            toast.error('Erro ao carregar corridas')
        } finally {
            setLoading(false)
        }
    }

    const filteredTrips = trips.filter(t => {
        const clientName = t.profiles_trips_client_idToprofiles?.full_name?.toLowerCase() || ''
        const driverName = t.profiles_trips_driver_idToprofiles?.full_name?.toLowerCase() || ''
        const matchesSearch = clientName.includes(searchTerm.toLowerCase()) ||
            driverName.includes(searchTerm.toLowerCase()) ||
            (t.id || '').toLowerCase().includes(searchTerm.toLowerCase())

        if (activeTab === 'live') return STATUS_META[t.status]?.live && matchesSearch
        if (activeTab === 'completed') return t.status === 'completed' && matchesSearch
        if (activeTab === 'cancelled') return t.status === 'cancelled' && matchesSearch
        return matchesSearch
    })
    const totalPages = Math.ceil(filteredTrips.length / itemsPerPage)
    const paginatedTrips = filteredTrips.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const statusMeta = (status) => STATUS_META[status] || { label: status, color: '#94a3b8', bg: '#f1f5f9', icon: <Clock size={13} />, live: false }

    return (
        <div className="trips-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <button className="btn-back-square" onClick={onBack}><ArrowLeft size={20} /></button>
                    <div className="title-area">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Navigation size={22} style={{ color: '#e91e63' }} /> Corridas
                            {liveCount > 0 && (
                                <span style={{
                                    background: '#10b981', color: '#fff',
                                    padding: '2px 10px', borderRadius: 20,
                                    fontSize: 11, fontWeight: 700,
                                    animation: 'pulse-badge 2s infinite'
                                }}>
                                    {liveCount} LIVE
                                </span>
                            )}
                        </h2>
                        <p>{filteredTrips.length} corridas · {liveCount} ativas agora</p>
                    </div>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="search-bar-premium">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar cliente, motorista ou ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={fetchTrips} style={{
                        padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                        background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 13, color: '#334155'
                    }}>
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                {TABS.map(tab => {
                    const count = tab.key === 'all' ? trips.length
                        : tab.key === 'live' ? liveCount
                        : trips.filter(t => t.status === tab.key).length

                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                padding: '8px 18px', borderRadius: 50, fontSize: 13, fontWeight: 600,
                                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                background: activeTab === tab.key
                                    ? (tab.key === 'live' ? '#10b981' : 'linear-gradient(135deg, #e91e63, #c2185b)')
                                    : '#f1f5f9',
                                color: activeTab === tab.key ? '#fff' : '#64748b',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.key === 'live' && activeTab === 'live' && (
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
                            )}
                            {tab.label}
                            <span style={{
                                background: activeTab === tab.key ? 'rgba(255,255,255,0.3)' : '#e2e8f0',
                                color: activeTab === tab.key ? '#fff' : '#94a3b8',
                                padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700
                            }}>{count}</span>
                        </button>
                    )
                })}
            </div>

            <div className="drivers-table-grid mt-6">
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="driver-card-premium horizontal skeleton h-32"></div>)
                ) : paginatedTrips.length > 0 ? (
                    paginatedTrips.map(trip => {
                        const meta = statusMeta(trip.status)
                        const isLive = meta.live
                        return (
                            <div key={trip.id} className="driver-card-premium horizontal animate-fade-in" style={{
                                borderLeft: isLive ? `4px solid ${meta.color}` : undefined
                            }}>
                                <div className="card-left-section">
                                    <div className="avatar-box" style={{ background: meta.bg, color: meta.color }}>
                                        {isLive ? <Activity size={20} /> : <Clock size={20} />}
                                    </div>
                                    <div className="info-group">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <h3 style={{ color: '#1e293b', margin: 0 }}>
                                                {trip.profiles_trips_client_idToprofiles?.full_name || 'Cliente Anónimo'}
                                            </h3>
                                            {isLive && (
                                                <span style={{
                                                    background: meta.color, color: '#fff',
                                                    padding: '1px 8px', borderRadius: 20,
                                                    fontSize: 9, fontWeight: 800, letterSpacing: 1,
                                                    animation: 'pulse-badge 2s infinite'
                                                }}>LIVE</span>
                                            )}
                                        </div>
                                        <p className="flex items-center gap-1" style={{ margin: '0 0 6px' }}>
                                            <User size={12} /> {trip.profiles_trips_driver_idToprofiles?.full_name || 'A aguardar motorista'}
                                        </p>
                                        <div className="flex flex-col gap-1 mt-2 text-[11px] font-semibold text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div>
                                                <span className="truncate max-w-[220px]">{trip.origin_address || '—'}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                                                <span className="truncate max-w-[220px]">{trip.dest_address || '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="card-right-section">
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                        background: meta.bg, color: meta.color,
                                        padding: '4px 12px', borderRadius: 20,
                                        fontSize: 11, fontWeight: 700
                                    }}>
                                        {meta.icon} {meta.label}
                                    </div>

                                    <div className="flex items-center gap-10 mt-3">
                                        <div className="price-tag-modern" style={{ marginRight: '20px' }}>
                                            Kz {Number(trip.final_fare || trip.estimated_fare || 0).toLocaleString()}
                                        </div>
                                        <button className="btn-pill-sm primary h-12 px-6" onClick={() => setSelectedTrip(trip)}>
                                            <ChevronRight size={18} />
                                            <span>Detalhes</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="empty-state-container py-40">
                        <Navigation size={64} className="opacity-10 mx-auto mb-4" />
                        <p>Nenhuma corrida encontrada.</p>
                    </div>
                )}
            </div>

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

            {selectedTrip && (
                <div className="receipt-overlay animate-fade-in" onClick={() => setSelectedTrip(null)}>
                    <div className="receipt-modal shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="receipt-header">
                            <FileText size={40} className="mx-auto mb-2 opacity-50" />
                            <h3>Detalhes da Corrida</h3>
                            <p className="text-xs opacity-70">TOT PREMIUM ANGOLA</p>
                        </div>
                        <div className="receipt-body">
                            {[
                                ['Código', `#${selectedTrip.id.substring(0, 8).toUpperCase()}`],
                                ['Status', (() => { const m = statusMeta(selectedTrip.status); return <span style={{ color: m.color, fontWeight: 700 }}>{m.label}</span> })()],
                                ['Data', new Date(selectedTrip.created_at).toLocaleDateString('pt-AO')],
                                ['Cliente', selectedTrip.profiles_trips_client_idToprofiles?.full_name || 'Anónimo'],
                                ['Motorista', selectedTrip.profiles_trips_driver_idToprofiles?.full_name || '—'],
                            ].map(([label, value]) => (
                                <div key={label} className="receipt-row">
                                    <label>{label}</label>
                                    <span>{value}</span>
                                </div>
                            ))}
                            <div className="receipt-divider" />
                            <div className="receipt-row">
                                <label>Origem</label>
                                <span className="text-right max-w-[150px] truncate">{selectedTrip.origin_address}</span>
                            </div>
                            <div className="receipt-row">
                                <label>Destino</label>
                                <span className="text-right max-w-[150px] truncate">{selectedTrip.dest_address}</span>
                            </div>
                            {selectedTrip.payment_method && (
                                <div className="receipt-row">
                                    <label>Pagamento</label>
                                    <span>{selectedTrip.payment_method}</span>
                                </div>
                            )}
                            <div className="receipt-divider" />
                            <div className="receipt-total">
                                <span className="total-label">Total</span>
                                <span className="total-value">Kz {Number(selectedTrip.final_fare || selectedTrip.estimated_fare || 0).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="receipt-actions">
                            <button className="btn-download-receipt" onClick={() => toast.success('Recibo exportado!')}>
                                <Download size={18} /> Exportar PDF
                            </button>
                            <button className="btn-close-receipt" onClick={() => setSelectedTrip(null)}>Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
