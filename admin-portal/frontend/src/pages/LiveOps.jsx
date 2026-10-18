import { useState, useEffect, useRef } from 'react'
import {
    Bike,
    MapPin,
    RefreshCw,
    Activity,
    Clock,
    Car,
    Navigation,
    Compass
} from 'lucide-react'
import adminApi from '../services/adminApi'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { resolveLiveOpsResults } from '../services/liveOpsData'
import { formatLocationAge, resolveDriverLocation } from '../services/driverLocation'

// Fix leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function createDriverIcon(color = '#e91e63') {
    return L.divIcon({
        className: '',
        html: `<div style="
            width:40px;height:40px;border-radius:50%;
            background:${color};
            border:3px solid #fff;
            box-shadow:0 4px 20px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            position:relative;
        ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
            <div style="
                position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
                width:10px;height:10px;background:${color};
                border-radius:0 0 50% 50%;clip-path:polygon(0 0,100% 0,50% 100%);
            "></div>
        </div>`,
        iconSize: [40, 46],
        iconAnchor: [20, 46],
        popupAnchor: [0, -46]
    })
}

// Luanda, Angola center
const MAP_CENTER = [-8.8368, 13.2343]

export default function LiveOps() {
    const [drivers, setDrivers] = useState([])
    const [activeTrips, setActiveTrips] = useState([])
    const [activeTripsTotal, setActiveTripsTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [errors, setErrors] = useState({ drivers: null, trips: null })
    const [lastUpdated, setLastUpdated] = useState({ drivers: null, trips: null })
    const [selectedDriver, setSelectedDriver] = useState(null)
    const intervalRef = useRef(null)
    const snapshotRef = useRef({ drivers: [], activeTrips: [], activeTripsTotal: 0, lastUpdated: { drivers: null, trips: null } })

    useEffect(() => {
        fetchData()
        intervalRef.current = setInterval(fetchData, 15000)
        return () => clearInterval(intervalRef.current)
    }, [])

    const fetchData = async () => {
        const results = await Promise.allSettled([
            adminApi.get('/admin/drivers/locations'),
            adminApi.get('/admin/trips', { params: { page: 1, limit: 100, status: 'live' } })
        ])
        const snapshot = resolveLiveOpsResults(results, snapshotRef.current)
        snapshotRef.current = snapshot
        setDrivers(snapshot.drivers)
        setActiveTrips(snapshot.activeTrips)
        setActiveTripsTotal(snapshot.activeTripsTotal)
        setErrors(snapshot.errors)
        setLastUpdated(snapshot.lastUpdated)
        setLoading(false)
    }

    const locationByDriverId = new Map(drivers.map(driver => [driver.id, resolveDriverLocation(driver)]))
    const driversWithCoords = drivers.filter(driver => locationByDriverId.get(driver.id)?.position)
    const freshLocationCount = drivers.filter(driver => locationByDriverId.get(driver.id)?.state === 'fresh').length
    const staleLocationCount = drivers.filter(driver => locationByDriverId.get(driver.id)?.state === 'stale').length

    const STATUS_COLOR = {
        active: '#10b981',
        busy: '#f59e0b',
        pending: '#e91e63',
        suspended: '#94a3b8'
    }

    const TRIP_STATUS_META = {
        requested: { label: 'Aguardando', color: '#f59e0b' },
        accepted: { label: 'Aceite', color: '#3b82f6' },
        arrived: { label: 'Chegou', color: '#8b5cf6' },
        ongoing: { label: 'Em Curso', color: '#10b981' },
    }

    return (
        <div className="bg-white rounded-[28px] p-5 sm:p-6 lg:p-8 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex flex-col gap-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
                <div className="title-area">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Operação em Tempo Real
                    </h2>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)] inline-block animate-pulse" />
                        <span>Sincronização em tempo real (15s)</span>
                        {lastUpdated.drivers && (
                            <span className="text-slate-400">
                                · GPS: {new Date(lastUpdated.drivers).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}
                        {lastUpdated.trips && (
                            <span className="text-slate-400">
                                · Corridas: {new Date(lastUpdated.trips).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    type="button"
                    className="tot-btn tot-btn--primary tot-btn--icon"
                    disabled={loading}
                    aria-label="Atualizar operação live"
                    title="Atualizar"
                >
                    <RefreshCw size={16} className={loading ? 'is-spinning' : ''} aria-hidden="true" />
                </button>
            </div>

            {/* KPI Cards (Estilo idêntico ao da página Faturas) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {[
                    { label: 'Motoristas Online', value: drivers.length, icon: <Bike size={22} /> },
                    { label: 'Posições Recentes', value: freshLocationCount, icon: <MapPin size={22} /> },
                    { label: 'Posições Desatualizadas', value: staleLocationCount, icon: <Clock size={22} /> },
                    { label: 'Corridas Activas', value: activeTrips.length, icon: <Activity size={22} /> },
                ].map((kpi, i) => (
                    <div
                        key={i}
                        style={{
                            background: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)',
                            borderRadius: '24px',
                            padding: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            boxShadow: '0 8px 24px rgba(233,30,99,0.2)',
                            color: 'white'
                        }}
                    >
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {kpi.icon}
                        </div>
                        <div>
                            <span style={{
                                display: 'block',
                                fontSize: '10px',
                                fontWeight: '800',
                                color: 'rgba(255,255,255,0.7)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {kpi.label}
                            </span>
                            <span style={{
                                fontSize: '24px',
                                fontWeight: '900',
                                lineHeight: '1.1'
                            }}>
                                {kpi.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content: Map + Sidebar */}
            <div className="flex flex-col lg:flex-row gap-5 items-stretch min-h-[580px]">
                {/* Map */}
                <div className="flex-1 min-h-[460px] lg:min-h-[580px] rounded-[24px] overflow-hidden border border-slate-200/80 relative shadow-sm bg-slate-100">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                            <RefreshCw size={32} className="mb-3 animate-spin text-[#E91E63]" />
                            <p className="text-xs font-medium">A carregar mapa operacional...</p>
                        </div>
                    ) : (
                        <MapContainer
                            center={MAP_CENTER}
                            zoom={12}
                            style={{ height: '100%', width: '100%', minHeight: '460px' }}
                            zoomControl={true}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {driversWithCoords.map(driver => {
                                const location = locationByDriverId.get(driver.id)
                                const locationColor = location.state === 'stale'
                                    ? '#64748b'
                                    : (STATUS_COLOR[driver.status] || '#e91e63')
                                return (
                                    <Marker
                                        key={driver.id}
                                        position={location.position}
                                        icon={createDriverIcon(locationColor)}
                                        eventHandlers={{ click: () => setSelectedDriver(driver) }}
                                    >
                                        <Popup>
                                            <div style={{ minWidth: 170 }}>
                                                <strong style={{ fontSize: 13, color: '#0f172a' }}>{driver.full_name}</strong>
                                                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
                                                    📞 {driver.phone || 'Sem telefone'}
                                                </p>
                                                <p style={{ margin: '6px 0 0', fontSize: 11 }}>
                                                    <span style={{
                                                        background: `${locationColor}18`,
                                                        color: locationColor,
                                                        padding: '3px 8px', borderRadius: 8, fontWeight: 700,
                                                        fontSize: 10
                                                    }}>
                                                        {location.state === 'stale' ? 'POSIÇÃO DESATUALIZADA' : (driver.status?.toUpperCase() || 'ONLINE')}
                                                    </span>
                                                </p>
                                                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
                                                    {location.updatedAt
                                                        ? `Último GPS: ${formatLocationAge(location.ageMs)}`
                                                        : 'Hora do GPS desconhecida'}
                                                </p>
                                                {location.accuracyMeters != null && (
                                                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#94a3b8' }}>
                                                        Precisão GPS: ±{Math.round(location.accuracyMeters)} m
                                                    </p>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                )
                            })}
                        </MapContainer>
                    )}

                    {/* Map Legend */}
                    <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-slate-200/80 flex items-center gap-4 text-xs">
                        {Object.entries(STATUS_COLOR).map(([status, color]) => (
                            <div key={status} className="flex items-center gap-1.5 font-medium text-slate-700">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <span className="capitalize">{status === 'active' ? 'Ativo' : status === 'busy' ? 'Ocupado' : status === 'pending' ? 'Pendente' : 'Suspenso'}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-full lg:w-[380px] flex flex-col gap-4 overflow-y-auto max-h-[680px]">
                    {/* Online Drivers Panel */}
                    <div className="bg-slate-50/70 rounded-[24px] border border-slate-200/80 overflow-hidden shadow-sm flex flex-col">
                        <div className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-white/80 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-pink-50 text-[#E91E63] flex items-center justify-center">
                                    <Bike size={16} />
                                </div>
                                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                                    Motoristas Online
                                </h3>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-pink-50 text-[#E91E63] border border-pink-200/60">
                                {drivers.length}
                            </span>
                        </div>

                        <div className="p-3 space-y-2.5 max-h-[320px] overflow-y-auto">
                            {errors.drivers && <ResourceError message={errors.drivers} onRetry={fetchData} />}
                            {loading ? (
                                <div className="py-6 text-center text-slate-400 text-xs">A carregar motoristas...</div>
                            ) : drivers.length === 0 && !errors.drivers ? (
                                <div className="py-8 text-center text-slate-400">
                                    <Bike size={32} className="mx-auto mb-2 opacity-30 text-slate-400" />
                                    <p className="text-xs">Nenhum motorista online</p>
                                </div>
                            ) : (
                                drivers.map(driver => {
                                    const loc = locationByDriverId.get(driver.id)
                                    const isFresh = loc?.state === 'fresh'
                                    const hasCoords = Boolean(loc?.position)
                                    const ageText = formatLocationAge(loc?.ageMs)
                                    const isSelected = selectedDriver?.id === driver.id

                                    return (
                                        <div
                                            key={driver.id}
                                            onClick={() => setSelectedDriver(driver)}
                                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-pink-50/70 border-[#E91E63]/40 shadow-sm ring-1 ring-[#E91E63]/20'
                                                    : 'bg-white hover:bg-white/90 border-slate-200/70 hover:border-slate-300'
                                            }`}
                                        >
                                            {/* Driver Header */}
                                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="relative w-8 h-8 rounded-full bg-pink-50 text-[#E91E63] flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-pink-100">
                                                        <Bike size={15} />
                                                        <span
                                                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                                                            style={{ backgroundColor: STATUS_COLOR[driver.status] || '#10b981' }}
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-slate-800 text-xs truncate">
                                                            {driver.full_name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-medium">
                                                            {driver.phone || 'Sem telefone'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    driver.status === 'active'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                                        : driver.status === 'busy'
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    {driver.status === 'active' ? 'Disponível' : driver.status === 'busy' ? 'Em Corrida' : (driver.status || 'Online')}
                                                </span>
                                            </div>

                                            {/* Telemetria de Coordenadas e Tempo (Chips estilizados e organizados) */}
                                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-[10px]">
                                                {/* Chip de Tempo */}
                                                {hasCoords ? (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                                                        isFresh
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                                    }`}>
                                                        <Clock size={11} />
                                                        <span>{isFresh ? 'GPS atualizado' : 'GPS desatualizado'} {ageText}</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium border border-slate-200/60">
                                                        <Clock size={11} />
                                                        <span>Sem sinal GPS</span>
                                                    </span>
                                                )}

                                                {/* Chip de Coordenadas */}
                                                {hasCoords && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-700 font-mono border border-slate-200/60">
                                                        <MapPin size={11} className="text-[#E91E63]" />
                                                        <span>{loc.position[0].toFixed(4)}, {loc.position[1].toFixed(4)}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Active Trips Panel */}
                    <div className="bg-slate-50/70 rounded-[24px] border border-slate-200/80 overflow-hidden shadow-sm flex flex-col">
                        <div className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-white/80 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                                    <Activity size={16} />
                                </div>
                                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                                    Corridas Activas
                                </h3>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-600 border border-blue-200/60">
                                {activeTripsTotal}
                            </span>
                        </div>

                        <div className="p-3 space-y-2.5 max-h-[320px] overflow-y-auto">
                            {errors.trips && <ResourceError message={errors.trips} onRetry={fetchData} />}
                            {loading ? (
                                <div className="py-6 text-center text-slate-400 text-xs">A carregar corridas...</div>
                            ) : activeTrips.length === 0 && !errors.trips ? (
                                <div className="py-8 text-center text-slate-400">
                                    <Car size={32} className="mx-auto mb-2 opacity-30 text-slate-400" />
                                    <p className="text-xs">Nenhuma corrida activa</p>
                                </div>
                            ) : (
                                activeTrips.map(trip => {
                                    const meta = TRIP_STATUS_META[trip.status] || { label: trip.status, color: '#94a3b8' }
                                    return (
                                        <div key={trip.id} className="p-3.5 rounded-2xl border border-slate-200/70 bg-white hover:border-slate-300 transition-all shadow-xs">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-mono text-xs font-bold text-slate-700">
                                                    #{trip.id.substring(0, 8).toUpperCase()}
                                                </span>
                                                <span
                                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                    style={{ background: `${meta.color}15`, color: meta.color }}
                                                >
                                                    {meta.label}
                                                </span>
                                            </div>
                                            <p className="font-semibold text-xs text-slate-800 mb-1.5 truncate">
                                                {trip.profiles_trips_client_idToprofiles?.full_name || 'Cliente'}
                                            </p>
                                            <div className="space-y-1 text-[11px] text-slate-500">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#E91E63] shrink-0" />
                                                    <span className="truncate">{trip.origin_address || 'Origem não informada'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-800 shrink-0" />
                                                    <span className="truncate">{trip.dest_address || 'Destino não informado'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ResourceError({ message, onRetry }) {
    return (
        <div role="alert" className="p-3 rounded-xl bg-orange-50 border border-orange-200/60 text-orange-800 text-xs my-2">
            <p className="mb-1.5 font-medium">{message}</p>
            <button
                type="button"
                onClick={onRetry}
                className="text-orange-900 font-bold underline hover:no-underline cursor-pointer"
            >
                Tentar novamente
            </button>
        </div>
    )
}
