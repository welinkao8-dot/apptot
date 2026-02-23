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
    Star
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

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

    const handleUpdateStatus = async (id, status) => {
        try {
            await axios.post(`${API_URL}/admin/drivers/${id}/status`, { status })
            fetchDrivers()
            toast.success(`Status atualizado com sucesso`)
            setIsVerifying(false)
            setSelectedDriver(null)
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
            setSelectedDriver(null)
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
                ) : filteredDrivers.length > 0 ? (
                    filteredDrivers.map(driver => (
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
                                        onClick={() => { setSelectedDriver(driver); setIsVerifying(true); }}
                                    >
                                        <Eye size={14} />
                                        <span>Detalhes</span>
                                    </button>
                                    {driver.status === 'active' && (
                                        <button
                                            className="btn-pill-sm outline"
                                            onClick={() => {
                                                setSelectedDriver(driver)
                                                setShowMap(true)
                                                setDriverLocation([-8.839 + (Math.random() - 0.5) * 0.01, 13.289 + (Math.random() - 0.5) * 0.01])
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

            {/* Verification Modal Code Remains Consisted with Previous State but with Dark Headings */}
            {isVerifying && selectedDriver && (
                <div className="verif-overlay" onClick={() => setIsVerifying(false)}>
                    <div className="verif-modal" onClick={e => e.stopPropagation()}>
                        <div className="verif-header">
                            <div className="verif-title">
                                <h3 className="text-[#1e293b]">Análise de Credenciais</h3>
                                <p>Motorista ID: #{selectedDriver.id.substring(0, 8).toUpperCase()}</p>
                            </div>
                            <button className="btn-close-circle" onClick={() => setIsVerifying(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="verif-body">
                            <div className="docs-scroll">
                                {['doc_bi_frente', 'doc_bi_verso', 'doc_carta_conducao'].map(key => (
                                    <div key={key} className="doc-item">
                                        <label className="text-[#94a3b8] font-bold text-[10px] uppercase">{key.replace('doc_', '').replace('_', ' ')}</label>
                                        <div className="img-container">
                                            {selectedDriver[key] ? (
                                                selectedDriver[key].toLowerCase().endsWith('.pdf') ? (
                                                    <iframe
                                                        src={selectedDriver[key]}
                                                        className="doc-embed w-full h-full border-none"
                                                        title="PDF Document"
                                                        type="application/pdf"
                                                        style={{ minHeight: '400px', display: 'block' }}
                                                    />
                                                ) : (
                                                    <img src={selectedDriver[key]} alt="Document" className="w-full h-full object-contain" />
                                                )
                                            ) : (
                                                <div className="doc-missing">Documento não anexado</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="verif-sidebar">
                                <div className="detail-row">
                                    <label>Nome Completo</label>
                                    <p>{selectedDriver.full_name}</p>
                                </div>
                                <div className="detail-row">
                                    <label>Telefone</label>
                                    <p>{selectedDriver.phone}</p>
                                </div>
                                <div className="detail-row">
                                    <label>Email</label>
                                    <p>{selectedDriver.email || 'Não informado'}</p>
                                </div>
                                <div className="detail-row">
                                    <label>Endereço</label>
                                    <p>{selectedDriver.address || 'Não informado'}</p>
                                </div>

                                <div className="verif-actions-vertical">
                                    {selectedDriver.status === 'pending' ? (
                                        <>
                                            <button className="btn-approve-big" onClick={() => handleUpdateStatus(selectedDriver.id, 'active')}>
                                                <CheckCircle2 size={20} />
                                                APROVAR MOTORISTA
                                            </button>
                                            <button className="btn-reject-big" onClick={() => handleUpdateStatus(selectedDriver.id, 'rejected')}>
                                                <XCircle size={20} />
                                                REJEITAR CADASTRO
                                            </button>
                                        </>
                                    ) : selectedDriver.status === 'active' ? (
                                        <button className="btn-reject-big text-white" onClick={() => handleToggleStatus(selectedDriver.id, 'deactivate')}>
                                            <XCircle size={20} className="text-white" />
                                            <span>DESATIVAR CONTA</span>
                                        </button>
                                    ) : (
                                        <button className="btn-approve-big" onClick={() => handleToggleStatus(selectedDriver.id, 'activate')}>
                                            <CheckCircle2 size={20} />
                                            ATIVAR CONTA
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function DriverMap({ location, name, status }) {
    const mapRef = useRef(null)
    useEffect(() => {
        if (!mapRef.current) return
        const instance = L.map(mapRef.current, { center: location, zoom: 15, zoomControl: false, attributionControl: false })
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(instance)
        const marker = L.divIcon({ className: 'custom-driver-marker', html: `<div class="marker-pin pink"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] })
        L.marker(location, { icon: marker }).addTo(instance).bindPopup(`<b>${name}</b>`).openPopup()
        return () => instance.remove()
    }, [location, name])
    return <div id="driver-live-map" ref={mapRef}></div>
}
