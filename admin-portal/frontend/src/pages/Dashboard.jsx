import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
    LayoutDashboard,
    Users,
    Bike,
    Settings,
    LogOut,
    Navigation,
    ShieldCheck,
    Wallet,
    History,
    FileText,
    CreditCard,
    Menu,
    RefreshCw,
    ArrowUpRight,
    Activity,
    CarFront,
    CircleAlert,
    Clock3,
    MapPin,
    Route,
    ReceiptText,
    TrendingUp,
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
} from 'recharts'
import adminApi from '../services/adminApi'
import { io } from 'socket.io-client'
import Drivers from './Drivers'
import Clients from './Clients'
import Pricing from './Pricing'
import Trips from './Trips'
import AuditLogs from './AuditLogs'
import Invoices from './Invoices'
import Configs from './Configs'
import LiveOps from './LiveOps'
import Payments from './Payments'
import { bindAdminDashboardEvents, bindAdminSocketAuth, getAdminSocketOptions } from '../services/adminPortalContracts'
import { formatKz, formatNumber, formatCompactNumber, formatDayShort, formatDateTime } from '../services/format'
import { describeAuditAction } from '../services/auditAction'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000'

const TRIP_STATUS = {
    requested: { label: 'A aguardar', tone: 'waiting' },
    accepted: { label: 'Aceite', tone: 'accepted' },
    arrived: { label: 'Chegou', tone: 'accepted' },
    ongoing: { label: 'Em curso', tone: 'live' },
    completed: { label: 'Concluída', tone: 'done' },
    cancelled: { label: 'Cancelada', tone: 'cancelled' },
}

const CATEGORY_COLORS = ['#c2185b', '#1d5bcf', '#007759', '#a35e00']

const NAV_ITEMS = [
    { key: 'overview', label: 'Visão geral', icon: LayoutDashboard },
    { key: 'liveops', label: 'Operação em curso', icon: Navigation, badge: 'Mapa' },
    { key: 'drivers', label: 'Motoristas', icon: Bike },
    { key: 'clients', label: 'Clientes', icon: Users },
    { key: 'pricing', label: 'Tarifas', icon: Wallet },
    { key: 'trips', label: 'Corridas', icon: History },
]

const SYSTEM_ITEMS = [
    { key: 'invoices', label: 'Faturas', icon: FileText },
    { key: 'payments', label: 'Pagamentos', icon: CreditCard },
    { key: 'auditlogs', label: 'Registo de auditoria', icon: ShieldCheck },
    { key: 'configs', label: 'Configurações', icon: Settings },
]

export default function Dashboard() {
    const { signOut } = useAuth()
    const [view, setView] = useState('overview')
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [stats, setStats] = useState({
        totalTrips: 0,
        completedTrips: 0,
        activeTrips: 0,
        totalDeliveries: 0,
        totalDrivers: 0,
        onlineDrivers: 0,
        totalClients: 0,
        totalRevenue: 0,
        todayRevenue: 0,
        monthlyRevenue: 0,
        todayTrips: 0,
    })
    const [pendingDrivers, setPendingDrivers] = useState([])
    const [analytics, setAnalytics] = useState({ dailyRevenue: [], categoryStats: [] })
    const [auditLogs, setAuditLogs] = useState([])
    const [recentTrips, setRecentTrips] = useState([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

    useEffect(() => {
        fetchDashboardData()

        const socket = io(`${SOCKET_URL}/admin`, getAdminSocketOptions(localStorage.getItem('tot_token')))
        const unbindAdminSocketAuth = bindAdminSocketAuth(socket)
        const unbindAdminEvents = bindAdminDashboardEvents(socket, {
            onDriverStatusUpdated: fetchDashboardData,
            onPricingUpdated: fetchDashboardData,
        })

        const interval = setInterval(() => {
            fetchDashboardData()
        }, 30000)

        return () => {
            socket.disconnect()
            unbindAdminEvents()
            unbindAdminSocketAuth()
            clearInterval(interval)
        }
    }, [])

    const fetchDashboardData = async () => {
        setIsRefreshing(true)
        try {
            const results = await Promise.allSettled([
                adminApi.get('/admin/stats'),
                adminApi.get('/admin/drivers/pending'),
                adminApi.get('/admin/analytics'),
                adminApi.get('/admin/logs', { params: { page: 1, limit: 4 } }),
                adminApi.get('/admin/trips', { params: { page: 1, limit: 5, status: 'all' } }),
            ])

            const getData = (result, defaultVal) => (result.status === 'fulfilled' && result.value && result.value.data) ? result.value.data : defaultVal

            const statsPayload = getData(results[0], null)
            if (statsPayload && typeof statsPayload === 'object') {
                setStats(prev => ({ ...prev, ...statsPayload }))
            } else {
                console.error('Resposta inválida de /admin/stats')
            }

            setPendingDrivers(getData(results[1], []))
            setAnalytics(getData(results[2], { dailyRevenue: [], categoryStats: [] }))
            const logsPayload = getData(results[3], { items: [] })
            const tripsPayload = getData(results[4], { items: [] })
            setAuditLogs(Array.isArray(logsPayload) ? logsPayload : (logsPayload?.items || []))
            setRecentTrips(Array.isArray(tripsPayload) ? tripsPayload : (tripsPayload?.items || []))
        } catch (error) {
            console.error('Falha ao carregar os dados do painel:', error)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
            setLastUpdatedAt(new Date())
        }
    }

    const goTo = nextView => {
        setView(nextView)
        setIsMobileMenuOpen(false)
    }

    const dailyRevenue = Array.isArray(analytics?.dailyRevenue) ? analytics.dailyRevenue : []
    const categoryStats = Array.isArray(analytics?.categoryStats) ? analytics.categoryStats : []
    const hasRevenue = dailyRevenue.some(item => Number(item?.revenue) > 0)
    const paidActivityTotal = categoryStats.reduce((total, item) => total + (Number(item?.value) || 0), 0)
    const pendingDriverCount = Array.isArray(pendingDrivers) ? pendingDrivers.length : 0
    const activeTrips = Number(stats?.activeTrips) || 0
    const onlineDrivers = Number(stats?.onlineDrivers) || 0
    const totalDeliveries = Number(stats?.totalDeliveries) || 0

    const headlineIndicators = [
        { key: 'today-revenue', label: 'Receita hoje', value: formatKz(stats?.todayRevenue) },
        { key: 'monthly-revenue', label: 'Receita este mês', value: formatKz(stats?.monthlyRevenue) },
        { key: 'today-trips', label: 'Corridas hoje', value: formatNumber(stats?.todayTrips), action: () => goTo('trips') },
    ]

    const renderNavButton = ({ key, label, icon: Icon, badge }) => (
        <button
            key={key}
            type="button"
            className={`nav-link ${view === key ? 'active' : ''}`}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => goTo(key)}
        >
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
            {badge && <small className="nav-live-badge">{badge}</small>}
        </button>
    )

    return (
        <div className="admin-layout">
            <button
                type="button"
                className={`sidebar-overlay ${isMobileMenuOpen ? 'visible' : ''}`}
                aria-label="Fechar navegação"
                onClick={() => setIsMobileMenuOpen(false)}
            />

            <aside className={`admin-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="admin-logo">
                    <span className="admin-logo-mark" aria-hidden="true">TOT</span>
                    <span className="admin-logo-copy">
                        <strong>TOT <em>Admin</em></strong>
                        <small>Operações urbanas</small>
                    </span>
                </div>

                <nav className="admin-nav" aria-label="Navegação principal">
                    <span className="admin-nav-section">Operação</span>
                    {NAV_ITEMS.map(renderNavButton)}

                    <span className="admin-nav-section">Gestão</span>
                    {SYSTEM_ITEMS.map(renderNavButton)}
                </nav>

                <div className="admin-footer">
                    <button type="button" className="nav-link btn-logout" onClick={signOut}>
                        <LogOut size={19} aria-hidden="true" />
                        <span>Terminar sessão</span>
                    </button>
                </div>
            </aside>

            <main className="admin-main">
                <div className="tot-admin-topbar">
                    <div className="tot-admin-topbar-context">
                        <strong>Consola de administração</strong>
                        <span aria-live="polite">
                            {lastUpdatedAt
                                ? `Dados atualizados às ${lastUpdatedAt.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}`
                                : 'A carregar dados…'}
                        </span>
                    </div>
                    <div className="tot-admin-topbar-right">
                        <span className="tot-admin-period">Turno atual</span>
                        <button
                            type="button"
                            className="mobile-toggle"
                            onClick={() => setIsMobileMenuOpen(open => !open)}
                            aria-label={isMobileMenuOpen ? 'Fechar navegação' : 'Abrir navegação'}
                            aria-expanded={isMobileMenuOpen}
                        >
                            <Menu size={20} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="dashboard-loading" role="status" aria-label="A carregar dados do painel">
                        <div className="dashboard-loading-title" />
                        <div className="dashboard-loading-operations"><span /><span /><span /></div>
                        <div className="dashboard-loading-finance"><span /><span /></div>
                    </div>
                ) : (
                    view === 'overview' && (
                        <div className="dashboard-content animate-fade-in">
                            <header className="page-header dashboard-overview-header">
                                <div className="page-title">
                                    <span className="tot-eyebrow">Painel de gestão</span>
                                    <h1>O que está a acontecer agora</h1>
                                    <p>Estado da operação, corridas de hoje e receita confirmada da plataforma.</p>
                                </div>
                                <div className="dashboard-header-actions">
                                    <button
                                        type="button"
                                        className="tot-btn tot-btn--ghost tot-btn--sm dashboard-refresh-button"
                                        onClick={fetchDashboardData}
                                        disabled={isRefreshing}
                                    >
                                        <RefreshCw size={15} className={isRefreshing ? 'is-spinning' : ''} aria-hidden="true" />
                                        <span>{isRefreshing ? 'A atualizar…' : 'Atualizar'}</span>
                                    </button>
                                </div>
                            </header>

                            <section className="tot-now" aria-label="Operação em curso">
                                <div className="tot-now-lead">
                                    <span className="tot-now-lamp" aria-hidden="true" />
                                    <span>
                                        <strong>Operação em curso</strong>
                                        <span>Agora mesmo</span>
                                    </span>
                                </div>
                                <button type="button" className="tot-now-item" onClick={() => goTo('liveops')}>
                                    <strong>{formatNumber(activeTrips)}</strong>
                                    <span>{activeTrips === 1 ? 'corrida ativa' : 'corridas ativas'}</span>
                                </button>
                                <button type="button" className="tot-now-item" onClick={() => goTo('drivers')}>
                                    <strong>{formatNumber(onlineDrivers)}</strong>
                                    <span>{onlineDrivers === 1 ? 'motorista online' : 'motoristas online'}</span>
                                </button>
                                {pendingDriverCount > 0 && (
                                    <button type="button" className="tot-now-alert" onClick={() => goTo('drivers')}>
                                        <CircleAlert size={16} aria-hidden="true" />
                                        <span>
                                            {pendingDriverCount === 1
                                                ? '1 motorista aguarda aprovação'
                                                : `${pendingDriverCount} motoristas aguardam aprovação`}
                                        </span>
                                    </button>
                                )}
                            </section>

                            <section className="tot-indicators" aria-label="Indicadores do período">
                                {headlineIndicators.map(({ key, label, value, action }) => (
                                    <article className="tot-indicator" key={key}>
                                        <span className="tot-indicator-label">{label}</span>
                                        <strong className="tot-indicator-value">{value}</strong>
                                        {action && (
                                            <button type="button" className="tot-indicator-link" onClick={action}>
                                                Ver corridas
                                            </button>
                                        )}
                                    </article>
                                ))}
                            </section>

                            {totalDeliveries > 0 && (
                                <p className="tot-indicators-note">
                                    {formatNumber(totalDeliveries)} entregas acumuladas na plataforma.
                                </p>
                            )}

                            <section className="tot-dashboard-analytics" aria-label="Receita">
                                <article className="tot-dashboard-card tot-dashboard-revenue-card">
                                    <div className="tot-dashboard-card-heading">
                                        <div>
                                            <span className="tot-eyebrow">Últimos 7 dias</span>
                                            <h2><TrendingUp size={18} aria-hidden="true" /> Receita confirmada</h2>
                                            <p>Valores recebidos e confirmados por dia.</p>
                                        </div>
                                        <span className="tot-dashboard-heading-icon" aria-hidden="true"><ReceiptText size={18} /></span>
                                    </div>
                                    {hasRevenue ? (
                                        <div className="tot-dashboard-chart">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={dailyRevenue} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
                                                    <defs>
                                                        <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#c2185b" stopOpacity={0.22} />
                                                            <stop offset="95%" stopColor="#c2185b" stopOpacity={0.01} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid vertical={false} stroke="#e4e7ec" />
                                                    <XAxis dataKey="date" tickFormatter={formatDayShort} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5b6675' }} tickMargin={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5b6675' }} tickFormatter={formatCompactNumber} domain={[0, 'auto']} width={54} />
                                                    <Tooltip
                                                        labelFormatter={formatDayShort}
                                                        formatter={value => [formatKz(value), 'Receita confirmada']}
                                                        contentStyle={{ borderRadius: 8, border: '1px solid #e4e7ec', fontSize: 13 }}
                                                    />
                                                    <Area type="monotone" dataKey="revenue" stroke="#c2185b" fill="url(#dashboardRevenueFill)" strokeWidth={2} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="tot-dashboard-empty-chart">
                                            <ReceiptText size={22} aria-hidden="true" />
                                            <div>
                                                <strong>Ainda sem pagamentos confirmados</strong>
                                                <span>Assim que o primeiro pagamento for confirmado, a receita diária aparece aqui.</span>
                                            </div>
                                        </div>
                                    )}
                                </article>

                                <article className="tot-dashboard-card tot-dashboard-category-card">
                                    <div className="tot-dashboard-card-heading">
                                        <div>
                                            <span className="tot-eyebrow">Atividade paga</span>
                                            <h2><CarFront size={18} aria-hidden="true" /> Por tipo de serviço</h2>
                                            <p>Pagamentos confirmados por categoria.</p>
                                        </div>
                                        <span className="tot-dashboard-heading-icon" aria-hidden="true"><Activity size={18} /></span>
                                    </div>
                                    {paidActivityTotal > 0 ? (
                                        <div className="tot-dashboard-category-body">
                                            <div className="tot-dashboard-donut">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie data={categoryStats} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none">
                                                            {categoryStats.map((item, index) => (
                                                                <Cell key={item.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <span><strong>{formatNumber(paidActivityTotal)}</strong><small>pagamentos</small></span>
                                            </div>
                                            <div className="tot-dashboard-category-legend">
                                                {categoryStats.map((item, index) => (
                                                    <div key={item.name}>
                                                        <span>
                                                            <i style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} aria-hidden="true" />
                                                            {item.name}
                                                        </span>
                                                        <strong>{formatNumber(item?.value)}</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="tot-dashboard-empty-chart">
                                            <Activity size={22} aria-hidden="true" />
                                            <div>
                                                <strong>Ainda sem atividade paga</strong>
                                                <span>A distribuição por serviço aparece após o primeiro pagamento confirmado.</span>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            </section>

                            <section className="tot-dashboard-lower-grid" aria-label="Atividade recente">
                                <article className="tot-dashboard-card tot-dashboard-trips-card">
                                    <div className="tot-dashboard-card-heading">
                                        <div>
                                            <span className="tot-eyebrow">Operação recente</span>
                                            <h2><History size={18} aria-hidden="true" /> Últimas corridas</h2>
                                            <p>Pedidos registados mais recentemente.</p>
                                        </div>
                                        <button type="button" className="tot-dashboard-text-link" onClick={() => goTo('trips')}>
                                            Ver corridas <ArrowUpRight size={15} aria-hidden="true" />
                                        </button>
                                    </div>
                                    {recentTrips.length > 0 ? (
                                        <div className="tot-dashboard-table-wrap">
                                            <table className="tot-dashboard-trips-table">
                                                <thead>
                                                    <tr>
                                                        <th>Cliente e percurso</th>
                                                        <th>Motorista</th>
                                                        <th>Estado</th>
                                                        <th>Valor</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recentTrips.map(trip => {
                                                        const status = TRIP_STATUS[trip.status] || { label: trip.status || 'Sem estado', tone: 'waiting' }
                                                        const client = trip.profiles_trips_client_idToprofiles?.full_name || 'Cliente não identificado'
                                                        const driver = trip.profiles_trips_driver_idToprofiles?.full_name || 'Aguarda motorista'
                                                        const fare = trip.final_fare ?? trip.estimated_fare ?? 0
                                                        return (
                                                            <tr key={trip.id}>
                                                                <td>
                                                                    <strong>{client}</strong>
                                                                    <span title={trip.origin_address || ''}>
                                                                        <MapPin size={13} aria-hidden="true" />
                                                                        {trip.origin_address || 'Origem não registada'}
                                                                    </span>
                                                                    <span title={trip.dest_address || ''}>
                                                                        <Route size={13} aria-hidden="true" />
                                                                        {trip.dest_address || 'Destino não registado'}
                                                                    </span>
                                                                </td>
                                                                <td><span className="tot-dashboard-driver-name">{driver}</span></td>
                                                                <td><span className={`status-pill status-pill--${status.tone}`}>{status.label}</span></td>
                                                                <td><strong className="tot-dashboard-fare">{formatKz(fare)}</strong></td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="tot-dashboard-empty-list">
                                            <Route size={20} aria-hidden="true" />
                                            <span>Ainda sem corridas registadas.</span>
                                        </div>
                                    )}
                                </article>

                                <aside className="tot-dashboard-card tot-dashboard-activity-card">
                                    <div className="tot-dashboard-card-heading">
                                        <div>
                                            <span className="tot-eyebrow">Administração</span>
                                            <h2><Clock3 size={18} aria-hidden="true" /> Atividade recente</h2>
                                            <p>Últimas ações registadas no painel.</p>
                                        </div>
                                    </div>
                                    <div className="tot-dashboard-activity-list">
                                        {auditLogs.length > 0 ? auditLogs.map(log => {
                                            const { label, tone } = describeAuditAction(log.action)
                                            return (
                                                <div className="tot-dashboard-activity-row" key={log.id || `${log.created_at}-${log.action}`}>
                                                    <span className={`tot-dashboard-activity-mark tot-dashboard-activity-mark--${tone}`} aria-hidden="true" />
                                                    <div>
                                                        <strong>{label}</strong>
                                                        <span>{log.profiles?.full_name || 'Administrador'} · {formatDateTime(log.created_at)}</span>
                                                    </div>
                                                </div>
                                            )
                                        }) : (
                                            <div className="tot-dashboard-empty-list">
                                                <Clock3 size={20} aria-hidden="true" />
                                                <span>Sem ações administrativas recentes.</span>
                                            </div>
                                        )}
                                    </div>
                                    <button type="button" className="tot-dashboard-text-link tot-dashboard-audit-link" onClick={() => goTo('auditlogs')}>
                                        Abrir registo de auditoria <ArrowUpRight size={15} aria-hidden="true" />
                                    </button>
                                </aside>
                            </section>
                        </div>
                    )
                )}

                {view === 'drivers' && <Drivers onBack={() => goTo('overview')} />}
                {view === 'clients' && <Clients onBack={() => goTo('overview')} />}
                {view === 'pricing' && <Pricing onBack={() => goTo('overview')} />}
                {view === 'trips' && <Trips onBack={() => goTo('overview')} />}
                {view === 'liveops' && <LiveOps onBack={() => goTo('overview')} />}
                {view === 'invoices' && <Invoices onBack={() => goTo('overview')} />}
                {view === 'payments' && <Payments onBack={() => goTo('overview')} />}
                {view === 'auditlogs' && <AuditLogs onBack={() => goTo('overview')} />}
                {view === 'configs' && <Configs onBack={() => goTo('overview')} />}
            </main>
        </div>
    )
}
