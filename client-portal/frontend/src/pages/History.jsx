import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Menu, ArrowLeft, Calendar, Navigation, MapPin, DollarSign, FileText, Download, X, Search, User, Home, History as HistoryIcon, LogOut, CreditCard, Gift } from 'lucide-react'
import axios from 'axios'
import './Dashboard.css'
import './History.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function History({ onBack }) {
    const { user } = useAuth()
    const [trips, setTrips] = useState([])
    const [stats, setStats] = useState({ count: 0, total: 0 })
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [selectedTrip, setSelectedTrip] = useState(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    useEffect(() => {
        fetchHistory()
        fetchMonthlyStats()
    }, [filter])

    const fetchHistory = async () => {
        try {
            setLoading(true)
            const res = await axios.get(`${API_URL}/trips/history/${user.id}`, {
                params: { status: filter }
            })
            setTrips(res.data)
        } catch (error) {
            console.error('Error fetching history:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchMonthlyStats = async () => {
        try {
            const res = await axios.get(`${API_URL}/trips/stats/monthly/${user.id}`)
            setStats(res.data)
        } catch (error) {
            console.error('Error fetching monthly stats:', error)
        }
    }

    const handleDownloadReceipt = (trip) => {
        // Mock download logic for now
        alert('Funcionalidade de Download de PDF será implementada com jsPDF em breve!')
    }

    return (
        <div className="history-container animate-fade-in">
            {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>}

            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="user-profile">
                        <div className="avatar-circle pink shadow"><User size={30} color="white" /></div>
                        <div className="user-info">
                            <h3>{user?.full_name || 'Usuário TOT'}</h3>
                            <p>{user?.phone || '9XXXXXXXX'}</p>
                        </div>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    <button className="nav-item" onClick={() => onBack()}>
                        <Home size={22} />
                        <span>Início</span>
                    </button>
                    <button className="nav-item active">
                        <HistoryIcon size={22} />
                        <span>Minhas Viagens</span>
                    </button>
                    <button className="nav-item"><CreditCard size={22} /> <span>Pagamentos</span></button>
                    <button className="nav-item"><Gift size={22} /> <span>Promoções</span></button>
                </nav>
            </aside>

            <header className="history-header">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setIsSidebarOpen(true)} className="btn-menu-header">
                        <Menu size={24} color="white" />
                    </button>
                    <h1>Minhas Viagens</h1>
                </div>

                <div className="stats-grid">
                    <div className="stat-card pink">
                        <span className="stat-label">Corridas no Mês</span>
                        <span className="stat-value">{stats.count}</span>
                        <Navigation size={40} className="stat-icon-floating" />
                    </div>
                    <div className="stat-card blue">
                        <span className="stat-label">Total Investido</span>
                        <span className="stat-value">Kz {Number(stats.total).toLocaleString()}</span>
                        <DollarSign size={40} className="stat-icon-floating" />
                    </div>
                </div>
            </header>

            <div className="filter-bar">
                {['all', 'completed', 'cancelled'].map(f => (
                    <button
                        key={f}
                        className={`filter-chip ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === 'all' ? 'Todas' : f === 'completed' ? 'Concluídas' : 'Canceladas'}
                    </button>
                ))}
            </div>

            <div className="history-list">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="trip-card skeleton h-40"></div>
                    ))
                ) : trips.length > 0 ? (
                    trips.map(trip => (
                        <div key={trip.id} className="trip-card">
                            <div className="trip-card-header">
                                <span className="trip-date">
                                    {new Date(trip.created_at).toLocaleDateString()} • {new Date(trip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className={`trip-status ${trip.status}`}>
                                    {trip.status === 'completed' ? 'Concluída' : 'Cancelada'}
                                </span>
                            </div>
                            <div className="trip-card-body">
                                <div className="trip-path">
                                    <div className="path-point">
                                        <MapPin size={16} color="#ec4899" />
                                        <span className="point-text">{trip.origin_address}</span>
                                    </div>
                                    <div className="path-point">
                                        <Navigation size={16} color="#1e293b" />
                                        <span className="point-text">{trip.dest_address}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="trip-card-footer">
                                <span className="trip-price">Kz {Number(trip.final_fare || trip.estimated_fare).toLocaleString()}</span>
                                {trip.status === 'completed' && (
                                    <button
                                        className="btn-receipt-small"
                                        onClick={() => setSelectedTrip(trip)}
                                    >
                                        <FileText size={14} /> Ver Recibo
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-state text-center py-20 text-slate-400">
                        <HistoryIcon size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Nenhuma viagem encontrada.</p>
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
                                <span className="total-value">Kz {Number(selectedTrip.final_fare || selectedTrip.estimated_fare).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="receipt-actions">
                            <button className="btn-download-receipt" onClick={() => handleDownloadReceipt(selectedTrip)}>
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
