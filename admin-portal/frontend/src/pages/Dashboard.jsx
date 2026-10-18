import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import adminApi from '../services/adminApi'
import { io } from 'socket.io-client'
import AdminLayout from '../components/layout/AdminLayout'
import DashboardOverview from './DashboardOverview'
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
import { getAdminAccessToken } from '../services/adminAuthSession'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Dashboard() {
    const { user } = useAuth()
    const [view, setView] = useState('overview')
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

        const socket = io(`${SOCKET_URL}/admin`, getAdminSocketOptions(getAdminAccessToken))
        const unbindAdminSocketAuth = bindAdminSocketAuth(socket)
        const unbindAdminEvents = bindAdminDashboardEvents(socket, {
            onDriverStatusUpdated: fetchDashboardData,
            onPricingUpdated: fetchDashboardData,
            onReconnected: fetchDashboardData,
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

            const getData = (result, defaultVal) =>
                result.status === 'fulfilled' && result.value && result.value.data
                    ? result.value.data
                    : defaultVal

            const statsPayload = getData(results[0], null)
            if (statsPayload && typeof statsPayload === 'object') {
                setStats(prev => ({ ...prev, ...statsPayload }))
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

    const adminName = user?.name || user?.email?.split('@')[0] || 'Admin'

    return (
        <AdminLayout
            activeView={view}
            onViewChange={setView}
            lastUpdatedAt={lastUpdatedAt}
            isRefreshing={isRefreshing}
            onRefresh={fetchDashboardData}
        >
            {view === 'overview' && (
                <DashboardOverview
                    stats={stats}
                    analytics={analytics}
                    recentTrips={recentTrips}
                    pendingDrivers={pendingDrivers}
                    adminName={adminName}
                    onSelectView={setView}
                />
            )}
            {view === 'liveops' && <LiveOps onSelectView={setView} />}
            {view === 'drivers' && <Drivers onSelectView={setView} />}
            {view === 'clients' && <Clients onSelectView={setView} />}
            {view === 'trips' && <Trips onSelectView={setView} />}
            {view === 'pricing' && <Pricing onSelectView={setView} />}
            {view === 'invoices' && <Invoices onSelectView={setView} />}
            {view === 'payments' && <Payments onSelectView={setView} />}
            {view === 'auditlogs' && <AuditLogs onSelectView={setView} />}
            {view === 'configs' && <Configs onSelectView={setView} />}
        </AdminLayout>
    )
}
