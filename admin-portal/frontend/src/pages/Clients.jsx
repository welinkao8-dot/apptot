import { useState, useEffect } from 'react'
import {
    Search,
    User,
    Phone,
    Calendar,
    ArrowLeft,
    History,
    Star,
    MoreHorizontal,
    CreditCard,
    MapPin,
    Clock,
    ChevronRight,
    Download,
    FileText,
    Mail,
    ShieldAlert,
    CheckCircle,
    DollarSign,
    Navigation,
    Activity
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Clients({ onBack }) {
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    
    // Sub-views states
    const [view, setView] = useState('list') // 'list' | 'history' | 'profile'
    const [selectedClient, setSelectedClient] = useState(null)
    const [allTrips, setAllTrips] = useState([])
    const [tripsLoading, setTripsLoading] = useState(false)
    const [selectedTrip, setSelectedTrip] = useState(null)

    useEffect(() => {
        fetchClients()
    }, [])

    const fetchClients = async () => {
        try {
            setLoading(true)
            const res = await axios.get(`${API_URL}/admin/clients`)
            setClients(Array.isArray(res.data) ? res.data : [])
        } catch (error) {
            console.error('❌ Error fetching clients:', error)
            toast.error('Erro ao carregar clientes')
            setClients([])
        } finally {
            setLoading(false)
        }
    }

    const fetchTrips = async () => {
        try {
            setTripsLoading(true)
            const res = await axios.get(`${API_URL}/admin/trips`)
            setAllTrips(res.data || [])
        } catch (error) {
            console.error('Error fetching trips:', error)
            toast.error('Erro ao carregar histórico de corridas')
        } finally {
            setTripsLoading(false)
        }
    }

    const handleViewHistory = async (client) => {
        setSelectedClient(client)
        setView('history')
        await fetchTrips()
    }

    const handleViewProfile = async (client) => {
        setSelectedClient(client)
        setView('profile')
        await fetchTrips()
    }

    const toggleClientStatus = async () => {
        const newStatus = selectedClient.status === 'suspended' ? 'active' : 'suspended';
        try {
            await axios.post(`${API_URL}/admin/clients/${selectedClient.id}/status`, { status: newStatus });
            toast.success(`Cliente ${newStatus === 'active' ? 'reativado' : 'suspenso'} com sucesso!`);
            
            const updatedClient = { ...selectedClient, status: newStatus };
            setSelectedClient(updatedClient);
            setClients(prev => prev.map(c => c.id === selectedClient.id ? updatedClient : c));
        } catch (error) {
            console.error('Error toggling client status:', error);
            toast.error('Erro ao atualizar status do cliente');
        }
    }

    const filteredClients = (Array.isArray(clients) ? clients : []).filter(c =>
        c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    )

    // Filter trips for selected client
    const clientTrips = selectedClient ? allTrips.filter(t => t.client_id === selectedClient.id) : []

    // Render list view
    if (view === 'list') {
        return (
            <div className="clients-module animate-fade-in">
                <div className="module-header-nav">
                    <div className="flex items-center gap-4">
                        <button className="btn-back-square" onClick={onBack}><ArrowLeft size={20} /></button>
                        <div className="title-area">
                            <h2>Explorador de Clientes</h2>
                            <p>{filteredClients.length} utilizadores registados</p>
                        </div>
                    </div>

                    <div className="header-actions">
                        <div className="search-bar-premium">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nome ou telefone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="drivers-table-grid mt-6">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="driver-card-premium horizontal skeleton h-32"></div>)
                    ) : filteredClients.length > 0 ? (
                        filteredClients.map(client => (
                            <div key={client.id} className="driver-card-premium horizontal animate-fade-in">
                                <div className="card-left-section">
                                    <div className="avatar-box">
                                        <User size={24} />
                                    </div>
                                    <div className="info-group">
                                        <h3>{client.full_name || 'Cliente sem nome'}</h3>
                                        <p>{client.phone}</p>
                                    </div>
                                    <div className="actions-inline">
                                        <button className="btn-pill-sm primary" onClick={() => handleViewHistory(client)}>
                                            <History size={14} />
                                            <span>Histórico</span>
                                        </button>
                                        <button className="btn-pill-sm outline text-pink-500" onClick={() => handleViewProfile(client)}>
                                            <User size={14} />
                                            <span>Perfil</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="card-right-section">
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                                                <CreditCard size={14} className="text-pink-500" />
                                                <span>{client.paidTripsCount || 0} CORRIDAS PAGAS</span>
                                            </div>
                                            <div className="rating-box">
                                                <span>★ 5.0</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                <span>Membro desde {new Date(client.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state-container py-40">
                            <User size={64} className="opacity-10 mx-auto mb-4" />
                            <p>Nenhum cliente encontrado.</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Render history view
    if (view === 'history') {
        return (
            <div className="clients-module animate-fade-in">
                <div className="module-header-nav">
                    <div className="flex items-center gap-4">
                        <button className="btn-back-square" onClick={() => setView('list')}><ArrowLeft size={20} /></button>
                        <div className="title-area">
                            <h2>Histórico de {selectedClient.full_name || 'Cliente'}</h2>
                            <p>{clientTrips.length} corridas registradas</p>
                        </div>
                    </div>
                </div>

                <div className="drivers-table-grid mt-6">
                    {tripsLoading ? (
                        [1, 2, 3].map(i => <div key={i} className="driver-card-premium horizontal skeleton h-32"></div>)
                    ) : clientTrips.length > 0 ? (
                        clientTrips.map(trip => (
                            <div key={trip.id} className="driver-card-premium horizontal animate-fade-in">
                                <div className="card-left-section">
                                    <div className="avatar-box">
                                        <Clock size={20} />
                                    </div>
                                    <div className="info-group">
                                        <h3 style={{ color: '#1e293b' }}>#{trip.id.substring(0, 8).toUpperCase()}</h3>
                                        <p className="flex items-center gap-1">
                                            <User size={12} /> {trip.profiles_trips_driver_idToprofiles?.full_name || 'A aguardar motorista'}
                                        </p>
                                        <div className="flex flex-col gap-1 mt-2 text-[11px] font-semibold text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div>
                                                <span className="truncate max-w-[300px]">{trip.origin_address}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                                                <span className="truncate max-w-[300px]">{trip.dest_address}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="card-right-section">
                                    <div className={`status-pill-mini ${trip.status}`}>
                                        {(trip.status || 'unknown').toUpperCase()}
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
                        ))
                    ) : (
                        <div className="empty-state-container py-40">
                            <Clock size={64} className="opacity-10 mx-auto mb-4" />
                            <p>Nenhuma corrida registrada para este cliente.</p>
                        </div>
                    )}
                </div>

                {selectedTrip && (
                    <div className="receipt-overlay animate-fade-in" onClick={() => setSelectedTrip(null)}>
                        <div className="receipt-modal shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="receipt-header">
                                <FileText size={40} className="mx-auto mb-2 opacity-50" />
                                <h3>Recibo de Viagem</h3>
                                <p className="text-xs opacity-70">TOT PREMIUM ANGOLA</p>
                            </div>
                            <div className="receipt-body">
                                <div className="receipt-row">
                                    <label>Código da Viagem</label>
                                    <span>#{selectedTrip.id.substring(0, 8).toUpperCase()}</span>
                                </div>
                                <div className="receipt-row">
                                    <label>Data</label>
                                    <span>{new Date(selectedTrip.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="receipt-row">
                                    <label>Cliente</label>
                                    <span>{selectedClient.full_name || 'Anónimo'}</span>
                                </div>
                                <div className="receipt-row">
                                    <label>Motorista</label>
                                    <span>{selectedTrip.profiles_trips_driver_idToprofiles?.full_name || 'Motorista'}</span>
                                </div>
                                <div className="receipt-divider"></div>
                                <div className="receipt-row">
                                    <label>Origem</label>
                                    <span className="text-right max-w-[150px] truncate">{selectedTrip.origin_address}</span>
                                </div>
                                <div className="receipt-row">
                                    <label>Destino</label>
                                    <span className="text-right max-w-[150px] truncate">{selectedTrip.dest_address}</span>
                                </div>
                                <div className="receipt-divider"></div>
                                <div className="receipt-total">
                                    <span className="total-label">Total Pago</span>
                                    <span className="total-value">Kz {Number(selectedTrip.final_fare || selectedTrip.estimated_fare || 0).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="receipt-actions">
                                <button className="btn-download-receipt" onClick={() => toast.success('Recibo baixado com sucesso!')}>
                                    <Download size={18} /> Baixar PDF
                                </button>
                                <button className="btn-close-receipt" onClick={() => setSelectedTrip(null)}>Fechar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Render profile view
    if (view === 'profile') {
        const totalSpent = clientTrips
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + Number(t.final_fare || 0), 0)

        const recentTrips = clientTrips.slice(0, 5)

        return (
            <div className="clients-module animate-fade-in">
                <div className="module-header-nav">
                    <div className="flex items-center gap-4">
                        <button className="btn-back-square" onClick={() => setView('list')}><ArrowLeft size={20} /></button>
                        <div className="title-area">
                            <h2>Perfil do Cliente</h2>
                            <p>Detalhes cadastrais de {selectedClient.full_name}</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
                    {/* Left Column: Personal info */}
                    <div style={{ background: '#ffffff', borderRadius: '28px', padding: '28px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.3)' }}>
                            <User size={40} />
                        </div>
                        <h3 style={{ color: '#1e293b', fontSize: '20px', fontWeight: '900', margin: '0 0 8px 0' }}>{selectedClient.full_name}</h3>
                        <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(233, 30, 99, 0.1)', color: '#e91e63', padding: '4px 14px', borderRadius: '12px' }}>
                            {selectedClient.role?.toUpperCase()}
                        </span>

                        <div style={{ width: '100%', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#475569' }}>
                                <Phone size={16} style={{ color: '#e91e63', flexShrink: 0 }} />
                                <span>{selectedClient.phone}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#475569' }}>
                                <Mail size={16} style={{ color: '#e91e63', flexShrink: 0, marginTop: '2px' }} />
                                <span style={{ wordBreak: 'break-all' }}>{selectedClient.email || 'Nenhum e-mail cadastrado'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#475569' }}>
                                <Calendar size={16} style={{ color: '#e91e63', flexShrink: 0 }} />
                                <span>Membro desde {new Date(selectedClient.created_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                                <Activity size={16} style={{ color: '#e91e63', flexShrink: 0 }} />
                                <span style={{ fontWeight: '800', color: selectedClient.status === 'suspended' ? '#ef4444' : '#10b981' }}>
                                    {selectedClient.status === 'suspended' ? 'CONTA SUSPENSA' : 'CONTA ATIVA'}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={toggleClientStatus}
                            style={{
                                width: '100%',
                                marginTop: '24px',
                                height: '48px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '14px',
                                fontWeight: '800',
                                borderRadius: '14px',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'white',
                                background: selectedClient.status === 'suspended'
                                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                boxShadow: selectedClient.status === 'suspended'
                                    ? '0 6px 18px rgba(16,185,129,0.3)'
                                    : '0 6px 18px rgba(239,68,68,0.3)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {selectedClient.status === 'suspended' ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
                            <span>{selectedClient.status === 'suspended' ? 'Ativar Conta' : 'Suspender Conta'}</span>
                        </button>
                    </div>

                    {/* Right Column: Statistics & Recent Activity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Stats Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            <div style={{ background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.2)', color: 'white' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Navigation size={22} />
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total de Corridas</span>
                                    <span style={{ fontSize: '26px', fontWeight: '900', lineHeight: '1.1' }}>{clientTrips.length}</span>
                                </div>
                            </div>
                            <div style={{ background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.2)', color: 'white' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <DollarSign size={22} />
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Gasto</span>
                                    <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1.1' }}>Kz {totalSpent.toLocaleString()}</span>
                                </div>
                            </div>
                            <div style={{ background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.2)', color: 'white' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Star size={22} />
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avaliação Média</span>
                                    <span style={{ fontSize: '26px', fontWeight: '900', lineHeight: '1.1' }}>5.0 ★</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Trips Card */}
                        <div style={{ background: '#ffffff', borderRadius: '28px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ margin: '0 0 18px 0', fontSize: '16px', fontWeight: '900', color: '#1e293b' }}>Corridas Recentes</h3>

                            {tripsLoading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>A carregar corridas...</div>
                            ) : recentTrips.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {recentTrips.map(trip => (
                                        <div key={trip.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(233,30,99,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e91e63', flexShrink: 0 }}>
                                                    <Clock size={16} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#334155' }}>#{trip.id.substring(0, 8).toUpperCase()}</div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{new Date(trip.created_at).toLocaleDateString()} • {trip.profiles_trips_driver_idToprofiles?.full_name || 'A aguardar'}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span className={`status-pill-mini ${trip.status}`} style={{ fontSize: '9px' }}>
                                                    {trip.status?.toUpperCase()}
                                                </span>
                                                <span style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', minWidth: '80px', textAlign: 'right' }}>
                                                    Kz {Number(trip.final_fare || trip.estimated_fare || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                    Nenhuma corrida recente.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return null
}
