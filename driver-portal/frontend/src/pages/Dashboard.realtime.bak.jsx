import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Menu, User, DollarSign, Navigation, Clock, Power, CheckCircle, ChevronRight, MapPin, Home, History, LogOut } from 'lucide-react'
import { toast } from 'react-hot-toast'
import './Dashboard.css'

export default function Dashboard() {
    const { user, signOut } = useAuth()
    const [isOnline, setIsOnline] = useState(false)
    const [stats, setStats] = useState({ rides: 0, earnings: 0 })

    // Simulação de solicitações
    const [requests] = useState([
        { id: 1, user: 'Roly Miguel', from: 'Vila Alice', to: 'Cazenga', price: '1.200', time: '2 min' },
        { id: 2, user: 'Zandira', from: 'Talatona', to: 'Mutamba', price: '2.500', time: '5 min' },
        { id: 3, user: 'João Paulo', from: 'Maianga', to: 'Patriota', price: '3.000', time: '8 min' },
    ])

    const handleToggleStatus = () => {
        const nextState = !isOnline
        setIsOnline(nextState)
        if (nextState) {
            toast.success('Você está ONLINE!', {
                style: { background: '#E91E63', color: '#fff', borderRadius: '15px' }
            })
        } else {
            toast('Você está OFFLINE', { icon: '⚪' })
        }
    }

    return (
        <div className="driver-dashboard-mobile">
            {/* Cabecalho Animado */}
            <header className="dash-header-premium">
                <div className="header-top">
                    <button className="icon-btn shadow-sm"><Menu size={24} /></button>
                    <h1 className="logo-text-small">TOT</h1>
                    <div className="profile-mini shadow-sm">
                        <User size={20} />
                    </div>
                </div>

                <div className="status-selector-container">
                    <div className={`status-pill-big ${isOnline ? 'online' : 'offline'}`}>
                        <span className="status-text">{isOnline ? 'VOCÊ ESTÁ ONLINE' : 'VOCÊ ESTÁ OFFLINE'}</span>
                        <button className={`toggle-switch ${isOnline ? 'active' : ''}`} onClick={handleToggleStatus}>
                            <Power size={22} color={isOnline ? '#fff' : '#94a3b8'} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="dash-body">
                {/* Boas vindas */}
                <section className="welcome-banner">
                    <h2>Olá, {user?.full_name?.split(' ')[0] || 'Motorista'}! 👋</h2>
                    <p>Veja seus resultados de hoje</p>
                </section>

                {/* Grid de Estatísticas com Degradê */}
                <section className="stats-grid-premium">
                    <div className="stat-card-gradient pink-grad shadow-lg">
                        <div className="stat-icon-bg"><Navigation size={22} color="#fff" /></div>
                        <div className="stat-content">
                            <span className="stat-label">Corridas Hoje</span>
                            <span className="stat-value">{stats.rides}</span>
                        </div>
                    </div>
                    <div className="stat-card-gradient purple-grad shadow-lg">
                        <div className="stat-icon-bg"><DollarSign size={22} color="#fff" /></div>
                        <div className="stat-content">
                            <span className="stat-label">Total Faturado</span>
                            <span className="stat-value">Kz {stats.earnings.toLocaleString()}</span>
                        </div>
                    </div>
                </section>

                {/* Lista de Solicitações */}
                <section className="requests-section">
                    <div className="section-header">
                        <h3>Solicitações Próximas</h3>
                        <span className="badge-pulse">{requests.length}</span>
                    </div>

                    <div className="requests-list">
                        {isOnline ? (
                            requests.map(req => (
                                <div key={req.id} className="request-card shadow-sm animate-fade-in">
                                    <div className="req-header">
                                        <div className="user-info-mini">
                                            <div className="avatar-letter">{req.user[0]}</div>
                                            <strong>{req.user}</strong>
                                        </div>
                                        <span className="req-price">Kz {req.price}</span>
                                    </div>
                                    <div className="req-path">
                                        <div className="path-item">
                                            <MapPin size={16} color="#E91E63" />
                                            <span>{req.from}</span>
                                        </div>
                                        <div className="path-line"></div>
                                        <div className="path-item">
                                            <Navigation size={16} color="#1e293b" />
                                            <span>{req.to}</span>
                                        </div>
                                    </div>
                                    <div className="req-footer">
                                        <div className="time-info"><Clock size={14} /> {req.time}</div>
                                        <button className="btn-accept-mini">ACEITAR</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="offline-state">
                                <Power size={48} color="#cbd5e1" />
                                <p>Fique online para ver as solicitações de hoje.</p>
                                <button className="btn-go-online" onClick={handleToggleStatus}>ATIVAR TURNO</button>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            {/* Navegação Inferior (Estilo App) */}
            <footer className="bottom-nav shadow-lg">
                <button className="nav-tab active"><Home size={22} /><span>Início</span></button>
                <button className="nav-tab"><DollarSign size={22} /><span>Ganhos</span></button>
                <button className="nav-tab"><History size={22} /><span>Viagens</span></button>
                <button className="nav-tab" onClick={signOut}><LogOut size={22} /><span>Sair</span></button>
            </footer>
        </div>
    )
}
