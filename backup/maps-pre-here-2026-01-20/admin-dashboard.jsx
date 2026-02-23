import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import toast from 'react-hot-toast'
import './Dashboard.css'
import {
    LayoutDashboard,
    Users,
    Bike,
    Car,
    Settings,
    LogOut,
    TrendingUp,
    Navigation,
    ShieldCheck,
    DollarSign,
    Activity,
    Map as MapIcon,
    Wallet,
    History,
    FileText
} from 'lucide-react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts'
import axios from 'axios'
import { io } from 'socket.io-client'
import Drivers from './Drivers'
import Clients from './Clients'
import Pricing from './Pricing'
import Trips from './Trips'

const API_URL = 'http://localhost:3000/admin'
const SOCKET_URL = 'http://localhost:3000/admin'

// Fix for Leaflet Icons
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DriverMarkerIcon = L.divIcon({
    className: 'custom-driver-marker',
    html: `<div class="marker-pin pink"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
})

const COLORS = ['#e91e63', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

export default function Dashboard() {
    const { user, signOut } = useAuth()
    const [view, setView] = useState('overview')
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [stats, setStats] = useState({
        totalTrips: 0,
        completedTrips: 0,
        activeTrips: 0,
        totalDeliveries: 0, // NEW
        totalDrivers: 0,
        onlineDrivers: 0,
        totalClients: 0,
        totalRevenue: 0,
        todayRevenue: 0
    })
    const [pendingDrivers, setPendingDrivers] = useState([])
    const [driverLocations, setDriverLocations] = useState([])
    const [analytics, setAnalytics] = useState({
        dailyRevenue: [],
        categoryStats: []
    })
    const [auditLogs, setAuditLogs] = useState([])
    const [loading, setLoading] = useState(true)

    const mapRef = useRef(null)
    const mapInstance = useRef(null)
    const markersGroup = useRef(L.layerGroup())

    useEffect(() => {
        fetchDashboardData()

        const socket = io(SOCKET_URL)

        socket.on('connect', () => console.log('Connected to Admin Real-time'))

        socket.on('dashboard_update', () => fetchDashboardData())

        // Novo listener para atualizações em massa de localização
        socket.on('drivers_locations_update', (drivers) => {
            // drivers = [{ id, lat, lng, full_name, status }]
            setDriverLocations(drivers)
        })

        // Polling de fallback para garantir consistência
        const interval = setInterval(() => {
            fetchDashboardData()
        }, 30000)

        return () => {
            socket.disconnect()
            clearInterval(interval)
        }
    }, [])

    const updateMapMarkers = () => {
        if (!mapInstance.current) return
        markersGroup.current.clearLayers()

        driverLocations.forEach(driver => {
            if (driver.current_lat && driver.current_lng) {
                const markerHtml = `
                    <div class="marker-pin ${driver.status === 'active' ? 'pink' : 'gray'}"></div>
                    <div class="marker-pulse ${driver.status === 'active' ? 'active' : ''}"></div>
                `

                const icon = L.divIcon({
                    className: 'custom-driver-marker',
                    html: markerHtml,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })

                L.marker([driver.current_lat, driver.current_lng], { icon })
                    .addTo(markersGroup.current)
                    .bindPopup(`
                        <div class="popup-driver">
                            <strong>${driver.full_name}</strong>
                            <span class="status ${driver.status}">${driver.status}</span>
                        </div>
                    `)
            }
        })
    }

    useEffect(() => {
        if (view === 'overview' && mapRef.current) {
            if (!mapInstance.current) {
                mapInstance.current = L.map(mapRef.current, {
                    center: [-8.839, 13.289], // Luanda
                    zoom: 13,
                    zoomControl: false,
                    attributionControl: false
                })
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstance.current)
                markersGroup.current.addTo(mapInstance.current)
            }
            updateMapMarkers()
        }
    }, [view, driverLocations])

    const fetchDashboardData = async () => {
        try {
            const results = await Promise.allSettled([
                axios.get(`${API_URL}/stats`),
                axios.get(`${API_URL}/drivers/pending`),
                axios.get(`${API_URL}/drivers/locations`),
                axios.get(`${API_URL}/analytics`),
                axios.get(`${API_URL}/logs`)
            ])

            // Helper to get data or empty default
            const getData = (result, defaultVal) => result.status === 'fulfilled' ? result.value.data : defaultVal

            if (results[0].status === 'fulfilled') {
                console.log('✅ Stats Data Received:', results[0].value.data)
                setStats(results[0].value.data)
            } else {
                console.error('❌ Failed to fetch Stats:', results[0].reason)
            }

            setPendingDrivers(getData(results[1], []))
            setDriverLocations(getData(results[2], []))
            setAnalytics(getData(results[3], { dailyRevenue: [], categoryStats: [] }))
            setAuditLogs(getData(results[4], []))

        } catch (error) {
            console.error('Critical Error fetching admin data:', error)
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className={`admin-layout ${isMobileMenuOpen ? 'mobile-menu-active' : ''}`}>
            {/* Mobile Overlay */}
            <div
                className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
            ></div>

            <aside className={`admin-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="admin-logo">TOT <span>ADMIN</span></div>

                <nav className="admin-nav">
                    <button className={`nav-link ${view === 'overview' ? 'active' : ''}`} onClick={() => { setView('overview'); setIsMobileMenuOpen(false); }}>
                        <LayoutDashboard size={20} /> <span className="ml-4">Visão Geral</span>
                    </button>
                    <button className={`nav-link ${view === 'drivers' ? 'active' : ''}`} onClick={() => { setView('drivers'); setIsMobileMenuOpen(false); }}>
                        <Bike size={20} /> <span className="ml-4">Motoristas</span>
                    </button>
                    <button className={`nav-link ${view === 'clients' ? 'active' : ''}`} onClick={() => { setView('clients'); setIsMobileMenuOpen(false); }}>
                        <Users size={20} /> <span className="ml-4">Clientes</span>
                    </button>
                    <button className={`nav-link ${view === 'pricing' ? 'active' : ''}`} onClick={() => { setView('pricing'); setIsMobileMenuOpen(false); }}>
                        <Wallet size={20} /> <span className="ml-4">Tarifas</span>
                    </button>
                    <button className={`nav-link ${view === 'trips' ? 'active' : ''}`} onClick={() => { setView('trips'); setIsMobileMenuOpen(false); }}>
                        <History size={20} /> <span className="ml-4">Corridas</span>
                    </button>
                    <button className={`nav-link ${view === 'configs' ? 'active' : ''}`} onClick={() => { setView('configs'); setIsMobileMenuOpen(false); }}>
                        <Settings size={20} /> <span className="ml-4">Configurações</span>
                    </button>
                </nav>

                <div className="admin-footer">
                    <button className="nav-link btn-logout" onClick={signOut}>
                        <LogOut size={20} /> <span className="ml-4">Sair</span>
                    </button>
                </div>
            </aside>

            <main className="admin-main">
                {loading ? (
                    <div className="admin-stats-grid">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="admin-stat-card skeleton-card">
                                <div className="skeleton-icon"></div>
                                <div className="skeleton-info">
                                    <div className="skeleton-line sm"></div>
                                    <div className="skeleton-line lg"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    view === 'overview' && (
                        <div className="dashboard-content animate-fade-in">
                            <header className="page-header">
                                <div className="page-title">
                                    <h1>Paineis de Controle</h1>
                                    <p>Bem-vindo ao TOT Command Center.</p>
                                </div>
                                <button className="mobile-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                                    <LayoutDashboard size={24} />
                                </button>
                            </header>

                            <div className="admin-stats-grid">
                                <div className="admin-stat-card">
                                    <div className="stat-icon pink"><DollarSign size={24} /></div>
                                    <div className="stat-info">
                                        <span className="label">Receita Acumulada</span>
                                        <span className="value truncate">Kz {stats.totalRevenue.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="stat-icon blue"><Activity size={24} /></div>
                                    <div className="stat-info">
                                        <span className="label">Corridas Ativas</span>
                                        <span className="value">{stats.activeTrips}</span>
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="stat-icon emerald"><ShieldCheck size={24} /></div>
                                    <div className="stat-info">
                                        <span className="label">Motoristas Ativos</span>
                                        <span className="value">{stats.onlineDrivers}</span>
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="stat-icon amber"><Wallet size={24} /></div>
                                    <div className="stat-info">
                                        <span className="label">Receita Hoje</span>
                                        <span className="value">Kz {(stats.todayRevenue || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="stat-icon pink"><Navigation size={24} /></div>
                                    <div className="stat-info">
                                        <span className="label">Corridas Hoje</span>
                                        <span className="value">{Math.floor(stats.totalTrips * 0.2)}</span>
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="stat-icon blue"><Bike size={24} /></div>
                                    <div className="stat-info">
                                        <span className="label">Total Entregas</span>
                                        <span className="value">{stats.totalDeliveries || 0}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="dashboard-grid">
                                <div className="admin-chart-card glass">
                                    <div className="card-header">
                                        <h3><TrendingUp size={20} className="text-pink-500" /> Tendência de Receita (7 Dias)</h3>
                                    </div>
                                    <div className="chart-container" style={{ height: 300 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analytics.dailyRevenue}>
                                                <defs>
                                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#e91e63" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#e91e63" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                    domain={[0, 1000000]}
                                                    ticks={[0, 250000, 500000, 750000, 1000000]}
                                                />
                                                <Tooltip />
                                                <Area type="monotone" dataKey="revenue" stroke="#e91e63" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="admin-chart-card glass">
                                    <div className="card-header">
                                        <h3><PieChart size={20} className="text-pink-500" /> Distribuição por Categoria</h3>
                                    </div>
                                    <div className="chart-container" style={{ height: 300 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={analytics.categoryStats}
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {analytics.categoryStats.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )
                )}

                {view === 'drivers' && <Drivers onBack={() => setView('overview')} />}
                {view === 'clients' && <Clients onBack={() => setView('overview')} />}
                {view === 'pricing' && <Pricing onBack={() => setView('overview')} />}
                {view === 'trips' && <Trips onBack={() => setView('overview')} />}

                {view !== 'overview' && !['drivers', 'clients', 'pricing', 'trips'].includes(view) && (
                    <div className="under-construction py-20 text-center text-slate-400">
                        <Settings size={48} className="mx-auto mb-4 animate-spin-slow" />
                        <h2>Módulo {view} em desenvolvimento...</h2>
                        <button className="btn-primary mt-4" onClick={() => setView('overview')}>Voltar para Dashboard</button>
                    </div>
                )}
            </main>
        </div>
    )
}
