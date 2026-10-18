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
import adminApi from '../services/adminApi'
import toast from 'react-hot-toast'
import HereMap from '../components/HereMap'
import { loadDriverLocation } from '../services/driverLocation'
import DriverLocationContent from '../components/DriverLocationContent'
import { formatDate, formatDateTime, formatKz } from '../services/format'
import StatusReasonDialog from '../components/StatusReasonDialog'
import { useNavigate } from 'react-router-dom'
import { buildDriversQuery, createRequestSequence, loadDriversPage, normalizeDriverTripsPage } from '../services/adminDriversList'


export default function Drivers({ onBack }) {
    const navigate = useNavigate()
    const handleBack = onBack || (() => navigate('/'))
    const [drivers, setDrivers] = useState([])
    const [driversTotal, setDriversTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [driversError, setDriversError] = useState(false)
    const driversRequest = useRef(createRequestSequence())
    const [filter, setFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedDriver, setSelectedDriver] = useState(null)
    const [statusAction, setStatusAction] = useState(null)
    const [statusPending, setStatusPending] = useState(false)
    const [showMap, setShowMap] = useState(false)
    const [driverLocation, setDriverLocation] = useState(null)
    const [isLocationLoading, setIsLocationLoading] = useState(false)
    const locationRequests = useRef(createRequestSequence())
    const [documentsLoading, setDocumentsLoading] = useState(false)
    const [documentsError, setDocumentsError] = useState(false)
    const [vehicleCategoryDraft, setVehicleCategoryDraft] = useState('')
    const [vehicleCategorySaving, setVehicleCategorySaving] = useState(false)

    // Sub-views and stats states
    const [view, setView] = useState('list') // 'list' | 'profile'
    const [allTrips, setAllTrips] = useState([])
    const [tripsLoading, setTripsLoading] = useState(false)
    const [tripsError, setTripsError] = useState(false)
    const tripsRequestId = useRef(0)
    const [driverTripsTotal, setDriverTripsTotal] = useState(0)
    const [driverTripsEarnings, setDriverTripsEarnings] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, filter])

    useEffect(() => {
        fetchDrivers()
        return () => { driversRequest.current.invalidate() }
    }, [currentPage, filter, searchTerm])

    const fetchDrivers = async () => {
        const requestId = driversRequest.current.begin()
        try {
            setLoading(true)
            setDriversError(false)
            const query = buildDriversQuery({ page: currentPage, pageSize: itemsPerPage, status: filter, search: searchTerm })
            const result = await loadDriversPage(adminApi, query)
            if (!driversRequest.current.isCurrent(requestId)) return
            setDrivers(result.items)
            setDriversTotal(result.total)
        } catch (error) {
            if (!driversRequest.current.isCurrent(requestId)) return
            console.error('❌ Error fetching drivers:', error)
            setDriversError(true)
            setDrivers([])
            setDriversTotal(0)
        } finally {
            if (driversRequest.current.isCurrent(requestId)) setLoading(false)
        }
    }

    const fetchTrips = async (driverId) => {
        const requestId = ++tripsRequestId.current
        try {
            setTripsLoading(true)
            setTripsError(false)
            const res = await adminApi.get(`/admin/drivers/${encodeURIComponent(driverId)}/trips`, { params: { page: 1, limit: 20 } })
            const result = normalizeDriverTripsPage(res.data)
            if (requestId !== tripsRequestId.current) return
            setAllTrips(result.items)
            setDriverTripsTotal(result.total)
            setDriverTripsEarnings(result.summary.completedEarnings)
        } catch (error) {
            if (requestId !== tripsRequestId.current) return
            console.error('Error fetching trips:', error)
            setAllTrips([])
            setDriverTripsTotal(0)
            setDriverTripsEarnings(0)
            setTripsError(true)
        } finally {
            if (requestId === tripsRequestId.current) setTripsLoading(false)
        }
    }

    const handleViewProfile = async (driver) => {
        setSelectedDriver(driver)
        setVehicleCategoryDraft(driver.vehicle_category || '')
        setView('profile')
        fetchDriverDocuments(driver.id)
        await fetchTrips(driver.id)
    }

    const handleUpdateVehicleCategory = async () => {
        if (!selectedDriver || !['car', 'moto', 'truck'].includes(vehicleCategoryDraft)) return
        setVehicleCategorySaving(true)
        try {
            const response = await adminApi.post(`/admin/drivers/${encodeURIComponent(selectedDriver.id)}/vehicle-category`, { vehicle_category: vehicleCategoryDraft })
            setSelectedDriver(response.data)
            setDrivers(current => current.map(driver => driver.id === response.data.id ? { ...driver, ...response.data } : driver))
            toast.success('Categoria de veículo atualizada. Motorista colocado offline.')
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erro ao atualizar categoria do veículo')
        } finally {
            setVehicleCategorySaving(false)
        }
    }

    const fetchDriverDocuments = async (driverId) => {
        setDocumentsLoading(true)
        setDocumentsError(false)
        try {
            const response = await adminApi.get(`/admin/drivers/${encodeURIComponent(driverId)}/documents`)
            setSelectedDriver(current => current?.id === driverId ? { ...current, ...response.data } : current)
        } catch (error) {
            console.error('Error fetching driver documents:', error)
            setDocumentsError(true)
        } finally {
            setDocumentsLoading(false)
        }
    }

    const handleShowDriverLocation = async (driver) => {
        setSelectedDriver(driver)
        setVehicleCategoryDraft(driver.vehicle_category || '')
        setDriverLocation(null)
        setIsLocationLoading(true)
        setView('profile')
        setShowMap(true)
        fetchDriverDocuments(driver.id)
        fetchTrips(driver.id)
        const result = await loadDriverLocation(adminApi, driver.id, locationRequests.current)
        if (result.state === 'stale') return
        if (result.state !== 'error') {
            const currentDriver = result.driver
            setSelectedDriver(currentDriver)
            setVehicleCategoryDraft(currentDriver.vehicle_category || '')
            setDriverLocation(result)
        } else {
            setDriverLocation(result)
        }
        setIsLocationLoading(false)
    }

    const closeDriverLocation = () => {
        locationRequests.current.invalidate()
        setIsLocationLoading(false)
        setShowMap(false)
    }

    const handleUpdateStatus = async (id, status, reason) => {
        setStatusPending(true)
        try {
            await adminApi.post(`/admin/drivers/${encodeURIComponent(id)}/status`, { status, reason })
            await fetchDrivers()
            toast.success(`Status atualizado com sucesso`)
            setSelectedDriver(prev => prev ? { ...prev, status } : null)
            setStatusAction(null)
        } catch (error) {
            toast.error('Erro ao atualizar status')
            throw error
        } finally {
            setStatusPending(false)
        }
    }

    const handleToggleStatus = async (id, action, reason) => {
        setStatusPending(true)
        try {
            await adminApi.post(`/admin/drivers/${encodeURIComponent(id)}/toggle-status`, { action, reason })
            await fetchDrivers()
            toast.success('Estado da conta alterado')
            const newStatus = action === 'activate' ? 'active' : 'suspended';
            setSelectedDriver(prev => prev ? { ...prev, status: newStatus } : null)
            setStatusAction(null)
        } catch (error) {
            toast.error('Erro ao alterar estado')
            throw error
        } finally {
            setStatusPending(false)
        }
    }

    const paginatedDrivers = drivers
    const filteredDriverCount = driversTotal
    const totalPages = Math.ceil(driversTotal / itemsPerPage)

    useEffect(() => {
        if (currentPage > Math.max(totalPages, 1)) setCurrentPage(Math.max(totalPages, 1))
    }, [currentPage, totalPages])

    // Calculate driver stats for profile page
    const driverTrips = selectedDriver ? allTrips : []
    const totalEarnings = driverTripsEarnings
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

                <div className="driver-profile-layout">
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
                                <span>Membro desde {formatDate(selectedDriver.created_at)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                                <Activity size={16} style={{ color: '#e91e63', flexShrink: 0 }} />
                                <span style={{ fontWeight: '800', color: selectedDriver.is_online ? '#10b981' : '#64748b' }}>
                                    {selectedDriver.is_online ? 'TRABALHANDO ONLINE' : 'DESLIGADO / OFFLINE'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                                <label htmlFor="driver-vehicle-category" style={{ fontWeight: 700, color: '#475569' }}>Categoria para despacho</label>
                                <select id="driver-vehicle-category" value={vehicleCategoryDraft} onChange={event => setVehicleCategoryDraft(event.target.value)} style={{ minHeight: 40, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', background: '#fff' }}>
                                    <option value="">Por classificar</option>
                                    <option value="moto">Motorizada</option>
                                    <option value="car">Carro</option>
                                    <option value="truck">Camião</option>
                                </select>
                                <button type="button" disabled={vehicleCategorySaving || !vehicleCategoryDraft} onClick={handleUpdateVehicleCategory} style={{ minHeight: 40, border: 0, borderRadius: 8, background: vehicleCategorySaving || !vehicleCategoryDraft ? '#cbd5e1' : '#e91e63', color: '#fff', fontWeight: 800, cursor: vehicleCategorySaving || !vehicleCategoryDraft ? 'not-allowed' : 'pointer' }}>
                                    {vehicleCategorySaving ? 'A guardar…' : 'Guardar categoria'}
                                </button>
                                <small style={{ color: '#64748b', lineHeight: 1.4 }}>Motoristas sem categoria não recebem ofertas. Alterar a categoria coloca o motorista offline.</small>
                            </div>
                        </div>

                        <div style={{ width: '100%', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {selectedDriver.status === 'pending' ? (
                                <>
                                    <button
                                        onClick={() => setStatusAction({ type: 'status', status: 'active' })}
                                        style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'white', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
                                    >
                                        <CheckCircle2 size={18} />
                                        <span>APROVAR CADASTRO</span>
                                    </button>
                                    <button
                                        onClick={() => setStatusAction({ type: 'status', status: 'rejected' })}
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
                                            handleShowDriverLocation(selectedDriver)
                                        }}
                                        style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', borderRadius: '12px', border: '1px solid #e91e63', cursor: 'pointer', color: '#e91e63', background: 'transparent' }}
                                    >
                                        <Navigation size={18} />
                                        <span>VER LOCALIZAÇÃO</span>
                                    </button>
                                    <button
                                        onClick={() => setStatusAction({ type: 'toggle', action: 'deactivate' })}
                                        style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'white', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 12px rgba(239,68,68,0.2)' }}
                                    >
                                        <XCircle size={18} />
                                        <span>DESATIVAR CONTA</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setStatusAction({ type: 'toggle', action: 'activate' })}
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
                                    <span style={{ fontSize: '26px', fontWeight: '900', lineHeight: '1.1' }}>{driverTripsTotal}</span>
                                </div>
                            </div>
                            <div style={{ background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.2)', color: 'white' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <DollarSign size={22} />
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ganhos Totais</span>
                                    <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1.1' }}>{formatKz(totalEarnings)}</span>
                                </div>
                            </div>
                            <div style={{ background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(233,30,99,0.2)', color: 'white' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Star size={22} />
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Classificação</span>
                                    <span style={{ fontSize: '16px', fontWeight: '800', lineHeight: '1.1' }}>Sem avaliações</span>
                                </div>
                            </div>
                        </div>

                        {/* Credentials Card */}
                        <div style={{ background: '#ffffff', borderRadius: '28px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#1e293b' }}>Documentos e Credenciais</h3>
                                {documentsError && <button type="button" onClick={() => fetchDriverDocuments(selectedDriver.id)}>Tentar carregar documentos</button>}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                {[
                                    { key: 'doc_bi_frente', label: 'BI Frente' },
                                    { key: 'doc_bi_verso', label: 'BI Verso' },
                                    { key: 'doc_carta_conducao', label: 'Carta de Condução' }
                                ].map(doc => (
                                    <div key={doc.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{doc.label}</span>
                                        <div style={{ height: '220px', background: '#f1f5f9', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1' }}>
                                            {documentsLoading && !selectedDriver[doc.key] ? (
                                                <span style={{ color: '#64748b', fontSize: 12 }}>A carregar…</span>
                                            ) : selectedDriver[doc.key] ? (
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
                                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>{documentsError ? 'Não foi possível carregar' : 'Documento não anexado'}</div>
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
                            ) : tripsError ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                    <p>Não foi possível carregar as corridas.</p>
                                    <button className="btn-pill-sm primary" onClick={fetchTrips}>Tentar novamente</button>
                                </div>
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
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{formatDate(trip.created_at)} • {trip.profiles_trips_client_idToprofiles?.full_name || 'Anônimo'}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span className={`status-pill-mini ${trip.status}`} style={{ fontSize: '9px' }}>
                                                    {trip.status?.toUpperCase()}
                                                </span>
                                                <span style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', minWidth: '80px', textAlign: 'right' }}>
                                                    Kz {Number(trip.final_fare ?? trip.estimated_fare ?? 0).toLocaleString('pt-AO')}
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
                {showMap && selectedDriver && (
                <div className="driver-map-overlay" onClick={closeDriverLocation}>
                        <div className="driver-map-dialog" role="dialog" aria-modal="true" aria-label={`Localização de ${selectedDriver.full_name}`} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Última localização recebida</h3>
                                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                                        Motorista: {selectedDriver.full_name}
                                        {driverLocation?.updatedAt && ` · ${formatDateTime(driverLocation.updatedAt)}`}
                                    </p>
                                </div>
                                <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }} onClick={closeDriverLocation}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div style={{ height: '350px', borderRadius: '18px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <DriverLocationContent
                                    location={driverLocation}
                                    isLoading={isLocationLoading}
                                    onRetry={() => handleShowDriverLocation(selectedDriver)}
                                >
                                    {driverLocation?.position && <DriverMap location={driverLocation.position} name={selectedDriver.full_name} />}
                                </DriverLocationContent>
                            </div>
                        </div>
                    </div>
                )}
                {statusAction && <StatusReasonDialog
                    title={statusAction.type === 'status'
                        ? (statusAction.status === 'active' ? 'Aprovar motorista' : 'Rejeitar motorista')
                        : (statusAction.action === 'activate' ? 'Ativar motorista' : 'Suspender motorista')}
                    description="Registe o motivo para alterar o estado desta conta."
                    confirmLabel={statusAction.type === 'status'
                        ? (statusAction.status === 'active' ? 'Aprovar cadastro' : 'Rejeitar cadastro')
                        : (statusAction.action === 'activate' ? 'Ativar conta' : 'Suspender conta')}
                    onSubmit={reason => statusAction.type === 'status'
                        ? handleUpdateStatus(selectedDriver.id, statusAction.status, reason)
                        : handleToggleStatus(selectedDriver.id, statusAction.action, reason)}
                    onClose={() => !statusPending && setStatusAction(null)}
                />}
            </div>
        )
    }

    return (
        <div className="drivers-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <div className="title-area">
                        <h2>Gestão de Motoristas</h2>
                        <p>{filteredDriverCount} {filteredDriverCount === 1 ? 'motorista encontrado' : 'motoristas encontrados'}</p>
                    </div>
                </div>

                <div className="header-actions">
                    <div className="tot-search">
                        <Search size={18} />
                        <input
                            type="text"
                            maxLength={120}
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
                            <option value="suspended">Suspensos</option>
                            <option value="rejected">Rejeitados</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="admin-record-list drivers-record-list mt-6">
                <div className="admin-record-list-head drivers-record-head" aria-hidden="true">
                    <span>Motorista</span><span>Conta</span><span>Disponibilidade</span><span className="text-right pr-2">Ações</span>
                </div>
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="admin-record-row admin-record-loading drivers-record-row" role="status" aria-label="A carregar motoristas"><span /><span /><span /><span /></div>)
                ) : driversError ? (
                    <div className="empty-state-container py-40">
                        <p>Erro ao carregar motoristas.</p>
                        <button className="btn-action-primary" onClick={fetchDrivers}>Tentar novamente</button>
                    </div>
                ) : paginatedDrivers.length > 0 ? (
                    paginatedDrivers.map(driver => (
                        <div key={driver.id} className="admin-record-row drivers-record-row animate-fade-in">
                            <div className="card-left-section">
                                <div className="avatar-box" aria-hidden="true">
                                    {(driver.full_name || 'MO').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
                                </div>
                                <div className="info-group">
                                    <h3>{driver.full_name}</h3>
                                    <p>{driver.phone}</p>
                                </div>
                            </div>

                            <div className={`driver-account-state ${driver.status}`}>
                                <span className={`status-pill-mini ${driver.status}`}>
                                    {({ active: 'Ativo', pending: 'Pendente', rejected: 'Rejeitado', suspended: 'Suspenso' })[driver.status] || driver.status}
                                </span>
                            </div>
                            <div className="driver-presence-label">
                                <span className={`status-indicator-dot ${driver.is_online ? 'online' : 'offline'}`}></span>
                                <span>{driver.is_online ? 'Online' : 'Offline'}</span>
                            </div>
                            <div className="actions-inline">
                                    <button
                                        type="button"
                                        className="btn-action-primary"
                                        onClick={() => handleViewProfile(driver)}
                                    >
                                        <Eye size={14} />
                                        <span>Detalhes</span>
                                    </button>
                                    {driver.status === 'active' && (
                                        <button
                                            type="button"
                                            className="btn-action-secondary"
                                            onClick={() => {
                                                handleShowDriverLocation(driver)
                                            }}
                                        >
                                            <Navigation size={14} />
                                            <span>Mapa</span>
                                        </button>
                                    )}
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
