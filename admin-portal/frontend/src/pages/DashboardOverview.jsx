import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    ArrowUpRight,
    Bike,
    CarFront,
    Package,
    TrendingUp,
    Calendar,
    ChevronDown,
    Plus,
    Radio,
    Sparkles,
    CheckCircle2,
    Clock,
    AlertCircle,
    UserCheck,
    Navigation,
    History,
    RefreshCw,
} from 'lucide-react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Cell,
} from 'recharts'
import adminApi from '../services/adminApi'
import { io } from 'socket.io-client'
import { bindAdminDashboardEvents, bindAdminSocketAuth, getAdminSocketOptions } from '../services/adminPortalContracts'
import { getAdminAccessToken } from '../services/adminAuthSession'
import { formatKz, formatNumber, formatDateTime, formatDayShort, formatServiceType } from '../services/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000'

const TRIP_STATUS_MAP = {
    requested: { label: 'Aguardando', dotClass: 'bg-amber-500', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/60' },
    accepted: { label: 'Aceite', dotClass: 'bg-blue-500', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/60' },
    arrived: { label: 'No local', dotClass: 'bg-indigo-500', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/60' },
    ongoing: { label: 'Em curso', dotClass: 'bg-sky-500', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/60' },
    completed: { label: 'Concluída', dotClass: 'bg-emerald-500', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
    cancelled: { label: 'Cancelada', dotClass: 'bg-rose-500', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/60' },
}

export default function DashboardOverview() {
    const navigate = useNavigate()
    const { user } = useAuth()

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
    const [recentTrips, setRecentTrips] = useState([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [loadErrors, setLoadErrors] = useState({})

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
                adminApi.get('/admin/trips', { params: { page: 1, limit: 5, status: 'all' } }),
            ])

            const errors = {}
            const responseData = (result, key) => {
                if (result.status !== 'fulfilled' || result.value?.data == null) {
                    errors[key] = 'Não foi possível carregar este conjunto de dados.'
                    return null
                }
                return result.value.data
            }

            const statsPayload = responseData(results[0], 'stats')
            if (statsPayload && typeof statsPayload === 'object' && !Array.isArray(statsPayload)) {
                setStats(prev => ({ ...prev, ...statsPayload }))
            } else {
                errors.stats = 'Resposta inválida das estatísticas.'
            }

            const driversPayload = responseData(results[1], 'pendingDrivers')
            if (Array.isArray(driversPayload)) setPendingDrivers(driversPayload)
            else if (driversPayload !== null) errors.pendingDrivers = 'Resposta inválida dos motoristas pendentes.'

            const analyticsPayload = responseData(results[2], 'analytics')
            if (analyticsPayload && Array.isArray(analyticsPayload.dailyRevenue)) setAnalytics(analyticsPayload)
            else if (analyticsPayload !== null) errors.analytics = 'Resposta inválida da análise diária.'

            const tripsPayload = responseData(results[3], 'recentTrips')
            const recentItems = Array.isArray(tripsPayload) ? tripsPayload : tripsPayload?.items
            if (Array.isArray(recentItems)) setRecentTrips(recentItems)
            else if (tripsPayload !== null) errors.recentTrips = 'Resposta inválida das corridas recentes.'

            setLoadErrors(errors)
        } catch (error) {
            console.error('Falha ao carregar os dados do painel:', error)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }

    const adminName = user?.full_name || user?.name || user?.email?.split('@')[0] || 'Admin'
    const dailyRevenue = Array.isArray(analytics?.dailyRevenue) ? analytics.dailyRevenue : []

    const barData = dailyRevenue.map(item => ({
        name: formatDayShort(item?.date) || item?.date || 'Dia',
        revenue: Number(item?.revenue) || 0,
        trips: Number(item?.trips) || 0,
    }))
    const hasRevenueData = barData.some(item => item.revenue > 0)
    const hasTripData = barData.some(item => item.trips > 0)

    const maxRevenue = Math.max(...barData.map(d => d.revenue), 0)
    const maxIndex = barData.findIndex(d => d.revenue === maxRevenue && d.revenue > 0)

    const sparklineData = barData.map(d => ({ val: d.trips }))

    const todayDateString = new Intl.DateTimeFormat('pt-AO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date())

    return (
        <div className="space-y-6">
            {/* SUB-HEADER (Welcome Back + Date Filter + Action) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-800">
                        Bem-vindo de volta, <span className="font-semibold text-slate-900">{adminName}</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Central de monitoramento e operações em tempo real
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Date Pill Selector */}
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200/70 shadow-sm text-xs font-medium text-slate-700">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{todayDateString}</span>
                        <ChevronDown size={13} className="text-slate-400" />
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={fetchDashboardData}
                        disabled={isRefreshing}
                        className="tot-btn tot-btn--primary tot-btn--icon"
                        aria-label="Atualizar dados do painel"
                        title="Atualizar dados"
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'is-spinning' : ''} aria-hidden="true" />
                    </button>

                    {/* Quick Action Pill Button */}
                    <Button
                        type="button"
                        onClick={() => navigate('/pricing')}
                        className="rounded-full bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
                    >
                        <Plus size={14} />
                        <span>Nova Tarifa</span>
                    </Button>
                </div>
            </div>

            {Object.keys(loadErrors).length > 0 && (
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Alguns dados do painel não foram atualizados. Use Atualizar para tentar novamente.
                </div>
            )}

            {/* MAIN 5-CARD GRID (Exact Quixotic Reference Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* -------------------------------------------------------------
                    CARD 1: RECEITA DE HOJE / OPERAÇÃO TOT (col-span-3)
                   ------------------------------------------------------------- */}
                <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-[28px] p-5 md:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/70 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800">Receita de Hoje</h3>
                                <p className="text-xs text-slate-400">Total faturado no turno</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/payments')}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                                aria-label="Ver pagamentos"
                            >
                                <ArrowUpRight size={16} />
                            </button>
                        </div>

                        {/* Operational revenue card (Branded TOT Pink Gradient) */}
                        <div className="relative overflow-hidden rounded-[22px] p-5 text-white bg-gradient-to-br from-[#E91E63] via-[#D81B60] to-[#880E4F] shadow-lg shadow-pink-500/25 my-4">
                            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />

                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-sm tracking-wider">TOT</span>
                                    <span className="text-[10px] font-medium opacity-90 px-1.5 py-0.5 rounded-full bg-white/20">OPERAÇÃO</span>
                                </div>
                                <Radio size={16} className="opacity-80 rotate-45" />
                            </div>

                            <div className="text-[11px] font-medium text-pink-100">Saldo Operacional</div>
                            <div className="text-2xl font-bold tracking-tight my-1 tabular-nums">
                                {loading || loadErrors.stats ? '—' : formatKz(stats?.todayRevenue || 0)}
                            </div>

                            <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/15 text-[10px]">
                                <span className="text-pink-100/90">Dados da operação</span>
                                <span className="font-semibold uppercase tracking-wider text-pink-100">TURNO ATUAL</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom monthly revenue indicator with pill badge */}
                    <div className="flex items-center justify-between pt-2">
                        <div>
                            <div className="text-[11px] text-slate-400 font-medium">Receita do Mês</div>
                            <div className="text-base font-bold text-slate-800 tabular-nums">
                                {loading || loadErrors.stats ? '—' : formatKz(stats?.monthlyRevenue || 0)}
                            </div>
                        </div>
                        <span className="text-[11px] text-slate-400">Variação disponível após histórico suficiente</span>
                    </div>
                </div>

                {/* -------------------------------------------------------------
                    CARD 2: ENGAGEMENT / VOLUME DE CORRIDAS (col-span-5)
                   ------------------------------------------------------------- */}
                <div className="lg:col-span-8 xl:col-span-5 bg-white rounded-[28px] p-5 md:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/70 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                                <TrendingUp size={16} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800">Volume de Faturamento</h3>
                                <p className="text-xs text-slate-400">Tendência dos últimos 7 dias</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                                Últimos 7 dias
                            </span>
                            <button
                                type="button"
                                onClick={() => navigate('/trips')}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                                aria-label="Ver histórico completo"
                            >
                                <ArrowUpRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* ROUNDED BAR CHART */}
                    <div className="h-52 w-full pt-2">
                        {hasRevenueData ? <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                                    tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                                    formatter={val => [formatKz(val), 'Faturamento']}
                                    contentStyle={{
                                        backgroundColor: '#1E293B',
                                        borderRadius: '12px',
                                        border: 'none',
                                        color: '#fff',
                                        fontSize: '12px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    }}
                                />
                                <Bar
                                    dataKey="revenue"
                                    radius={[14, 14, 14, 14]}
                                    maxBarSize={42}
                                >
                                    {barData.map((entry, index) => {
                                        const isPeak = index === maxIndex && entry.revenue > 0
                                        return (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={isPeak ? '#E91E63' : '#E2E8F0'}
                                                className="transition-all hover:opacity-90"
                                            />
                                        )
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer> : (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                {loading ? 'A carregar dados...' : loadErrors.analytics ? 'Não foi possível carregar a receita.' : 'Sem receita confirmada no período.'}
                            </div>
                        )}
                    </div>
                </div>

                {/* -------------------------------------------------------------
                    CARD 3: CORRIDAS TOTAIS COM ONDA SPARKLINE (col-span-4)
                   ------------------------------------------------------------- */}
                <div className="lg:col-span-12 xl:col-span-4 bg-white rounded-[28px] p-5 md:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/70 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800">Total de Corridas</h3>
                                <p className="text-xs text-slate-400">Atividade acumulada na plataforma</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/trips')}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                                aria-label="Ver histórico"
                            >
                                <ArrowUpRight size={16} />
                            </button>
                        </div>

                        <div className="text-center my-3">
                            <span className="text-xs text-slate-400 font-medium">Corridas Registradas</span>
                            <div className="text-3xl font-bold tracking-tight text-slate-800 tabular-nums">
                                {loading || loadErrors.stats ? '—' : formatNumber(stats?.totalTrips || 0)}
                            </div>
                        </div>

                        {/* Smooth Area Wave Sparkline */}
                        <div className="h-20 w-full">
                            {hasTripData ? <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={sparklineData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="totWaveGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#E91E63" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#E91E63" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <Area
                                        type="monotone"
                                        dataKey="val"
                                        stroke="#E91E63"
                                        strokeWidth={2.5}
                                        fillOpacity={1}
                                        fill="url(#totWaveGrad)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer> : (
                                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                    {loading ? 'A carregar dados...' : loadErrors.analytics ? 'Não foi possível carregar os dados.' : 'Sem corridas registadas neste período.'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Pill Buttons */}
                    <div className="flex items-center gap-2 pt-3">
                        <button
                            type="button"
                            onClick={() => navigate('/trips')}
                            className="flex-1 py-2.5 px-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                            <History size={14} />
                            <span>Ver Corridas ↑</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/liveops')}
                            className="flex-1 py-2.5 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <Navigation size={14} />
                            <span>Operação Live ↓</span>
                        </button>
                    </div>
                </div>

                {/* -------------------------------------------------------------
                    CARD 4: HISTÓRICO DE CORRIDAS (col-span-8)
                   ------------------------------------------------------------- */}
                <div className="lg:col-span-8 bg-white rounded-[28px] p-5 md:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/70">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800">Últimas Corridas</h3>
                            <p className="text-xs text-slate-400">Atividades e viagens em tempo real</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/trips')}
                            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                            aria-label="Ver todas as corridas"
                        >
                            <ArrowUpRight size={16} />
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-100 pb-2">
                                    <th className="font-medium pb-2">Cliente / Serviço</th>
                                    <th className="font-medium pb-2">Data & Hora</th>
                                    <th className="font-medium pb-2">Estado</th>
                                    <th className="font-medium pb-2 text-right">Tarifa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-400">
                                            A carregar corridas recentes...
                                        </td>
                                    </tr>
                                ) : loadErrors.recentTrips && recentTrips.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-amber-700">
                                            Não foi possível carregar corridas recentes.
                                        </td>
                                    </tr>
                                ) : recentTrips.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-400">
                                            Nenhuma corrida recente registada.
                                        </td>
                                    </tr>
                                ) : (
                                    recentTrips.slice(0, 4).map(trip => {
                                        const statusConfig = TRIP_STATUS_MAP[trip.status] || {
                                            label: trip.status || 'Pendente',
                                            dotClass: 'bg-slate-400',
                                            badgeClass: 'bg-slate-50 text-slate-600',
                                        }

                                        return (
                                            <tr key={trip.id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="py-3.5 pr-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-pink-50 text-[#E91E63] flex items-center justify-center font-bold text-xs shrink-0">
                                                            {trip.category === 'delivery' ? (
                                                                <Package size={15} />
                                                            ) : (
                                                                <Bike size={15} />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-slate-800 text-xs">
                                                                {trip.profiles_trips_client_idToprofiles?.full_name || 'Cliente não identificado'}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 capitalize">
                                                                {formatServiceType(trip.category, 'Categoria não registada')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="py-3.5 pr-3 text-slate-600">
                                                    {formatDateTime(trip.created_at)}
                                                </td>

                                                <td className="py-3.5 pr-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusConfig.badgeClass}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
                                                        <span>{statusConfig.label}</span>
                                                    </span>
                                                </td>

                                                <td className="py-3.5 text-right font-bold text-slate-800 tabular-nums">
                                                    {formatKz(trip.final_fare ?? trip.estimated_fare ?? 0)}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* -------------------------------------------------------------
                    CARD 5: MOTORISTAS ONLINE & PENDENTES (col-span-4)
                   ------------------------------------------------------------- */}
                <div className="lg:col-span-4 bg-white rounded-[28px] p-5 md:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/70 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-pink-50 text-[#E91E63] flex items-center justify-center">
                                    <Bike size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-800">Motoristas em Linha</h3>
                                    <p className="text-xs text-slate-400">Disponibilidade em tempo real</p>
                                </div>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                                Live
                            </span>
                        </div>

                        <div className="mt-4 mb-2">
                            <div className="text-3xl font-bold tracking-tight text-slate-800 tabular-nums">
                                {loading || loadErrors.stats ? '—' : formatNumber(stats?.onlineDrivers || 0)}
                                <span className="text-sm font-normal text-slate-400 ml-1.5">conectados</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                De um total de <strong className="text-slate-700">{loading || loadErrors.stats ? '—' : formatNumber(stats?.totalDrivers || 0)}</strong> motoristas cadastrados
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h4 className="text-xs font-semibold text-slate-800">Aprovações Pendentes</h4>
                                <p className="text-[11px] text-slate-400">Novos pedidos de cadastro</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/drivers')}
                                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                                aria-label="Ver motoristas pendentes"
                            >
                                <ArrowUpRight size={14} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center -space-x-2">
                                {!loadErrors.pendingDrivers && pendingDrivers.slice(0, 4).map((driver, idx) => {
                                    const initials = (driver.full_name || driver.name || 'M')
                                        .split(' ')
                                        .map(n => n[0])
                                        .slice(0, 2)
                                        .join('')
                                        .toUpperCase()

                                    return (
                                        <Avatar key={driver.id || idx} className="w-8 h-8 border-2 border-white shadow-sm ring-1 ring-slate-200/60 bg-pink-100 text-[#E91E63]">
                                            <AvatarFallback className="text-[10px] font-bold bg-pink-50 text-[#E91E63]">
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                    )
                                })}

                                {pendingDrivers.length > 4 && (
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-sm">
                                        +{pendingDrivers.length - 4}
                                    </div>
                                )}

                                {!loading && !loadErrors.pendingDrivers && pendingDrivers.length === 0 && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <CheckCircle2 size={14} className="text-emerald-500" />
                                        <span>Sem aprovações pendentes</span>
                                    </div>
                                )}

                                {loading && (
                                    <span className="text-xs text-slate-500">A carregar aprovações...</span>
                                )}
                                {!loading && loadErrors.pendingDrivers && (
                                    <span className="text-xs text-amber-700">Não foi possível carregar as aprovações.</span>
                                )}
                            </div>

                                {!loadErrors.pendingDrivers && pendingDrivers.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => navigate('/drivers')}
                                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-[#E91E63] border border-pink-200/60 transition-colors"
                                >
                                    Revisar ({pendingDrivers.length})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
