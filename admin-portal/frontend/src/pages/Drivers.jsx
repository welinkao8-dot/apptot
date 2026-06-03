import { useState, useEffect, useRef } from 'react'
import {
    Search,
    Filter,
    Eye,
    CheckCircle2,
    XCircle,
    User,
    Phone,
    ArrowLeft,
    X,
    Navigation,
    Download,
    Star,
    Mail,
    Calendar,
    Activity,
    CheckCircle,
    ShieldAlert,
    Clock,
    DollarSign,
    FileText,
    ChevronRight,
    MapPin
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import HereMap from '../components/HereMap'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Drivers({ onBack }) {
    const [drivers, setDrivers] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedDriver, setSelectedDriver] = useState(null)
    const [isVerifying, setIsVerifying] = useState(false)
    const [showMap, setShowMap] = useState(false)
    const [driverLocation, setDriverLocation] = useState(null)

    // Sub-views and stats states
    const [view, setView] = useState('list') // 'list' | 'profile'
    const [allTrips, setAllTrips] = useState([])
    const [tripsLoading, setTripsLoading] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, filter])

    useEffect(() => {
        fetchDrivers()
    }, [])

    const fetchDrivers = async () => {
        try {
            setLoading(true)
            const res = await axios.get(`${API_URL}/admin/drivers`)
            console.log('🔍 DRIVERS API RESPONSE:', res.data)
            console.log('🔍 Is Array?', Array.isArray(res.data))
            console.log('🔍 Length:', res.data?.length)
            setDrivers(Array.isArray(res.data) ? res.data : [])
        } catch (error) {
            console.error('❌ Error fetching drivers:', error)
            toast.error('Erro ao carregar motoristas')
            setDrivers([])
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

    const handleViewProfile = async (driver) => {
        setSelectedDriver(driver)
        setView('profile')
        await fetchTrips()
    }

    const handleUpdateStatus = async (id, status) => {
        try {
            await axios.post(`${API_URL}/admin/drivers/${id}/status`, { status })
            fetchDrivers()
            toast.success(`Status atualizado com sucesso`)
            setIsVerifying(false)
            setSelectedDriver(prev => prev ? { ...prev, status } : null)
        } catch (error) {
            toast.error('Erro ao atualizar status')
        }
    }

    const handleToggleStatus = async (id, action) => {
        try {
            await axios.post(`${API_URL}/admin/drivers/${id}/toggle-status`, { action })
            fetchDrivers()
            toast.success('Estado da conta alterado')
            setIsVerifying(false)
            const newStatus = action === 'activate' ? 'active' : 'suspended';
            setSelectedDriver(prev => prev ? { ...prev, status: newStatus } : null)
        } catch (error) {
            toast.error('Erro ao alterar estado')
        }
    }

    const filteredDrivers = (Array.isArray(drivers) ? drivers : []).filter(d => {
        const matchesFilter = filter === 'all' || d.status === filter
        const nameMatch = d.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
        const phoneMatch = d.phone?.includes(searchTerm)
        return matchesFilter && (nameMatch || phoneMatch)
    })

    const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage)
    const paginatedDrivers = filteredDrivers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    // Calculate driver stats for profile page
    const driverTrips = selectedDriver ? allTrips.filter(t => t.driver_id === selectedDriver.id) : []
    const totalEarnings = driverTrips
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + Number(t.final_fare || 0), 0)
    const recentTrips = driverTrips.slice(0, 5)

    if (view === 'profile' && selectedDriver) {
        return (
            <div className="drivers-module animate-fade-in">
                <div className="module-header-nav">
                    <div className="flex items-center gap-4">
                        <button className="btn-back-square" onClick={() => setView('list')}><ArrowLeft size={20} /></button>
                        <div className="title-area">
                            <h2>Perfil do Motorista</h2>
                            <p>Detalhes profissionais e credenciais de {selectedDriver.full_name}</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start', marginTop: '24px' }}>
                    {/* Left Column: Personal info & actions */}
                    <div style={{ background: '#ffffff', borderRadius: '28px', padding: '28px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.3)', position: 'relative' }}>
                            <User size={40} />
                            <div style={{ position: 'absolute', bottom: '0', right: '0', width: '20px', height: '20px', borderRadius: '50%', background: selectedDriver.is_online ? '#10b981' : '#cbd5e1', border: '3px solid #ffffff' }}></div>
                        </div>
                        <h3 style={{ color: '#1e293b', fontSize: '20px', fontWeight: '900', margin: '0 0 8px 0' }}>{selectedDriver.full_name}</h3>
                        <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(233, 30, 99, 0.1)', color: '#e91e63', padding: '4px 14px', borderRadius: '12px', textTransform: 'uppercase' }}>
                            {selectedDriver.status}
                        </span>

                        <div style={{ width: '100%', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#475569' }}>
                                <Phone size={16} style={{ color: '#e91e63', flexShrink: 0 }} />
                                <span>{selectedDriver.phone}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#475569' }}>
                                <Mail size={16} style={{ color: '#e91e63', flexShrink: 0, marginTop: '2px' }} />
                                <span style={{ wordBreak: 'break-all' }}>{selectedDriver.email || 'Nenhum e-mail cadastrado'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#475569' }}>
                                <MapPin size={16} style={{ color: '#e91e63', flexShrink: 0, marginTop: '2px' }} />
                                <span>{selectedDriver.address || 'Endereço não informado'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#475569' }}>
                                <Calendar size={16} style={{ color: '#e91e63', flexShrink: 0 }} />
                                <span>Membro desde {new Date(selectedDriver.created_at || Date.now()).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                                <Activity size={16} style={{ color: '#e91e63', flexShrink: 0 }} />
                                <span style={{ fontWeight: '800', color: selectedDriver.is_online ? '#10b981' : '#64748b' }}>
                                    {selectedDriver.is_online ? 'TRABALHANDO ONLINE' : 'DESLIGADO / OFFLINE'}
                                </span>
                            </div>
                        </div>

                        <div style={{ width: '100%', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {selectedDriver.status === 'pending' ? (
                                <>
                                    <button
                                        onClick={() => handleUpdateStatus(selectedDriver.id, 'active')}
                                        style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'white', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
                                    >
                                        <CheckCircle2 size={18} />
                                        <span>APROVAR CADASTRO</span>
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus(selectedDriver.id, 'rejected')}
                                        style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'white', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 12px rgba(239,68,68,0.2)' }}
                                    >
                                        <XCircle size={18} />
                                        <span>REJEITAR CADASTRO</span>
                                    </button>
                                </>
                            ) : selectedDriver.status === 'active' ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setDriverLocation([-8.839 + (Math.random() - 0.5) * 0.01, 13.289 + (Math.random() - 0.5) * 0.01])
                                            setShowMap(true)
                                        }}
                                        style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', borderRadius: '12px', border: '1px solid #e91e63', cursor: 'pointer', color: '#e91e63', background: 'transparent' }}
                                    >
                                        <Navigation size={18} />
                                        <span>VER LOCALIZAÇÃO</span>
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus(selectedDriver.id, 'deactivate')}
                                        style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'white', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 12px rgba(239,68,68,0.2)' }}
                                    >
                                        <XCircle size={18} />
                                        <span>DESATIVAR CONTA</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => handleToggleStatus(selectedDriver.id, 'activate')}
                                    style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: '800', borderRadius: '14px', border: 'none', cursor: 'pointer', color: 'white', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 6px 18px rgba(16,185,129,0.3)' }}
                                >
                                    <CheckCircle2 size={18} />
                                    <span>ATIVAR CONTA</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Stats, Creds and Trips */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Stats Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            <div style={{ background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.2)', color: 'white' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Navigation size={22} />
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total de Corridas</span>
                                    <span style={{ fontSize: '26px', fontWeight: '900', lineHeight: '1.1' }}>{driverTrips.length}</span>
                                </div>
                            </div>
                            <div style={{ background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.2)', color: 'white' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <DollarSign size={22} />
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ganhos Totais</span>
                                    <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1.1' }}>Kz {totalEarnings.toLocaleString()}</span>
                                </div>
                            </div>
                            <div style={{ background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.2)', color: 'white' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Star size={22} />
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Classificação</span>
                                    <span style={{ fontSize: '26px', fontWeight: '900', lineHeight: '1.1' }}>{Number(selectedDriver.rating || 5.0).toFixed(1)} ★</span>
                                </div>
                            </div>
                        </div>

                        {/* Credentials Card */}
                        <div style={{ background: '#ffffff', borderRadius: '28px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ margin: '0 0 18px 0', fontSize: '16px', fontWeight: '900', color: '#1e293b' }}>Documentos e Credenciais</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                {[
                                    { key: 'doc_bi_frente', label: 'BI Frente' },
                                    { key: 'doc_bi_verso', label: 'BI Verso' },
                                    { key: 'doc_carta_conducao', label: 'Carta de Condução' }
                                ].map(doc => (
                                    <div key={doc.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{doc.label}</span>
                                        <div style={{ height: '220px', background: '#f1f5f9', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1' }}>
                                            {selectedDriver[doc.key] ? (
                                                selectedDriver[doc.key].toLowerCase().endsWith('.pdf') ? (
                                                    <iframe
                                                        src={selectedDriver[doc.key]}
                                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                                        title={doc.label}
                                                    />
                                                ) : (
                                                    <img src={selectedDriver[doc.key]} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                )
                                            ) : (
                                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Documento não anexado</div>
                                            )}
                                        </div>
                                        {selectedDriver[doc.key] && (
                                            <a href={selectedDriver[doc.key]} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#e91e63', textDecoration: 'none', background: 'rgba(233, 30, 99, 0.05)', height: '32px', borderRadius: '8px' }}>
                                                <Download size={12} /> Abrir Documento
                                            </a>
                                        )}
                                    </div>
                                ))}
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
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{new Date(trip.created_at).toLocaleDateString()} • {trip.profiles_trips_client_idToprofiles?.full_name || 'Anônimo'}</div>
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

                {/* Real-time Location Map Modal */}
                {showMap && driverLocation && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setShowMap(false)}>
                        <div style={{ background: 'white', borderRadius: '28px', width: '100%', maxWidth: '600px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Localização em Tempo Real</h3>
                                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>Motorista: {selectedDriver.full_name}</p>
                                </div>
                                <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }} onClick={() => setShowMap(false)}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div style={{ height: '350px', borderRadius: '18px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <DriverMap location={driverLocation} name={selectedDriver.full_name} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="drivers-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <button className="btn-back-square" onClick={onBack}><ArrowLeft size={20} /></button>
                    <div className="title-area">
                        <h2>Gestão de Motoristas</h2>
                        <p>{filteredDrivers.length} motoristas encontrados</p>
                    </div>
                </div>

                <div className="header-actions">
                    <div className="search-bar-premium">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar motorista..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <Filter size={16} />
                        <select className="filter-select-premium" value={filter} onChange={(e) => setFilter(e.target.value)}>
                            <option value="all">Filtro: Todos</option>
                            <option value="pending">Pendentes</option>
                            <option value="active">Ativos</option>
                            <option value="rejected">Rejeitados</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="drivers-table-grid mt-6">
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="driver-card-premium horizontal skeleton h-32"></div>)
                ) : paginatedDrivers.length > 0 ? (
                    paginatedDrivers.map(driver => (
                        <div key={driver.id} className="driver-card-premium horizontal animate-fade-in">
                            <div className="card-left-section">
                                <div className="avatar-box">
                                    <User size={24} />
                                </div>
                                <div className="info-group">
                                    <h3>{driver.full_name}</h3>
                                    <p>{driver.phone}</p>
                                </div>
                                <div className="actions-inline">
                                    <button
                                        className="btn-pill-sm primary"
                                        onClick={() => handleViewProfile(driver)}
                                    >
                                        <Eye size={14} />
                                        <span>Detalhes</span>
                                    </button>
                                    {driver.status === 'active' && (
                                        <button
                                            className="btn-pill-sm outline"
                                            onClick={() => {
                                                setSelectedDriver(driver)
                                                setDriverLocation([-8.839 + (Math.random() - 0.5) * 0.01, 13.289 + (Math.random() - 0.5) * 0.01])
                                                setShowMap(true)
                                            }}
                                        >
                                            <Navigation size={14} className="text-pink-500" />
                                            <span className="text-pink-500">Mapa</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="card-right-section">
                                <div className={`status-pill-mini ${driver.status}`}>
                                    {driver.status.toUpperCase()}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="rating-box">
                                        <span>★ {Number(driver.rating || 5).toFixed(1)}</span>
                                    </div>
                                    <div className={`status-indicator-dot ${driver.is_online ? 'online' : 'offline'}`}></div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-state-container py-40">
                        <p>Nenhum motorista encontrado.</p>
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
        </div>
    )
}

function DriverMap({ location, name }) {
    if (!location) return null
    const coords = { lat: location[0], lng: location[1] }

    const handleMapReady = (map) => {
        if (window.H) {
            const marker = new window.H.map.Marker(coords)
            map.addObject(marker)
            map.setCenter(coords)
        }
    }

    return (
        <HereMap 
            center={coords} 
            zoom={15} 
            onMapReady={handleMapReady} 
        />
    )
}
