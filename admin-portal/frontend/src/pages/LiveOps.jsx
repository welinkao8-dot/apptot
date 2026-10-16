import { useState, useEffect, useRef } from 'react'
import {
    ArrowLeft,
    Navigation,
    Bike,
    Users,
    MapPin,
    RefreshCw,
    Activity,
    Clock,
    Car
} from 'lucide-react'
import adminApi from '../services/adminApi'
import toast from 'react-hot-toast'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { resolveLiveOpsResults } from '../services/liveOpsData'
import { formatLocationAge, resolveDriverLocation } from '../services/driverLocation'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000'

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

export default function LiveOps({ onBack }) {
    const [drivers, setDrivers] = useState([])
    const [activeTrips, setActiveTrips] = useState([])
    const [loading, setLoading] = useState(true)
    const [errors, setErrors] = useState({ drivers: null, trips: null })
    const [lastUpdated, setLastUpdated] = useState({ drivers: null, trips: null })
    const [selectedDriver, setSelectedDriver] = useState(null)
    const intervalRef = useRef(null)
    const snapshotRef = useRef({ drivers: [], activeTrips: [], lastUpdated: { drivers: null, trips: null } })

    useEffect(() => {
        fetchData()
        intervalRef.current = setInterval(fetchData, 15000)
        return () => clearInterval(intervalRef.current)
    }, [])

    const fetchData = async () => {
        const results = await Promise.allSettled([
            adminApi.get('/admin/drivers/locations'),
            adminApi.get('/admin/trips')
        ])
        const snapshot = resolveLiveOpsResults(results, snapshotRef.current)
        snapshotRef.current = snapshot
        setDrivers(snapshot.drivers)
        setActiveTrips(snapshot.activeTrips)
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
        <div className="live-ops-layout">
            {/* Header */}
            <div className="module-header-nav" style={{ flexShrink: 0 }}>
                <div className="flex items-center gap-4">
                    <button className="btn-back-square" onClick={onBack}><ArrowLeft size={20} /></button>
                    <div className="title-area">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Navigation size={22} style={{ color: '#e91e63' }} /> Operação em Tempo Real
                        </h2>
                        <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: '#10b981',
                                boxShadow: '0 0 0 3px #10b98133',
                                display: 'inline-block',
                                animation: 'pulse-dot 2s infinite'
                            }} />
                            {drivers.length} motoristas online · {freshLocationCount} posições recentes · {staleLocationCount} desatualizadas · {activeTrips.length} corridas activas
                            {lastUpdated.drivers && ` · Motoristas: ${new Date(lastUpdated.drivers).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                            {lastUpdated.trips && ` · Corridas: ${new Date(lastUpdated.trips).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                        </p>
                    </div>
                </div>
                <button onClick={fetchData} style={{
                    padding: '8px 18px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 13, color: '#334155', fontWeight: 600
                }}>
                    <RefreshCw size={14} /> Atualizar
                </button>
            </div>

            {/* Main Content: Map + Sidebar */}
            <div className="live-ops-body">
                {/* Map */}
                <div className="live-ops-map" style={{ position: 'relative' }}>
                    {loading ? (
                        <div style={{
                            height: '100%', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', background: '#f8fafc',
                            color: '#94a3b8'
                        }}>
                            <RefreshCw size={32} style={{ marginBottom: 12, animation: 'spin 1s linear infinite' }} />
                            <p>A carregar mapa...</p>
                        </div>
                    ) : (
                        <MapContainer
                            center={MAP_CENTER}
                            zoom={12}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={true}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {driversWithCoords.map(driver => (
                                (() => {
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
                                                <div style={{ minWidth: 160 }}>
                                                    <strong style={{ fontSize: 14 }}>{driver.full_name}</strong>
                                                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                                                        📞 {driver.phone}
                                                    </p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 12 }}>
                                                        <span style={{
                                                            background: `${locationColor}22`,
                                                            color: locationColor,
                                                            padding: '2px 8px', borderRadius: 10, fontWeight: 700
                                                        }}>
                                                            {location.state === 'stale' ? 'POSIÇÃO DESATUALIZADA' : (driver.status?.toUpperCase() || 'ONLINE')}
                                                        </span>
                                                    </p>
                                                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
                                                        {location.updatedAt
                                                            ? `Último GPS ${formatLocationAge(location.ageMs)}`
                                                            : 'Hora do GPS desconhecida'}
                                                    </p>
                                                    {location.accuracyMeters != null && (
                                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
                                                            Precisão GPS: ±{Math.round(location.accuracyMeters)} m
                                                        </p>
                                                    )}
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )
                                })()
                            ))}
                        </MapContainer>
                    )}

                    {/* Map Legend */}
                    <div style={{
                        position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
                        background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: '10px 16px',
                        backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        display: 'flex', gap: 16, fontSize: 12
                    }}>
                        {Object.entries(STATUS_COLOR).map(([status, color]) => (
                            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                                <span style={{ color: '#334155', fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="live-ops-sidebar">
                    {/* Online Drivers */}
                    <div className="live-ops-panel">
                        <div style={{ padding: '14px 18px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Bike size={18} style={{ color: '#e91e63' }} />
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                                Motoristas Online ({drivers.length})
                            </h3>
                        </div>
                        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                            {errors.drivers && <ResourceError message={errors.drivers} onRetry={fetchData} />}
                            {loading ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>A carregar...</div>
                            ) : drivers.length === 0 && errors.drivers ? null : drivers.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                                    <Bike size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                                    <p style={{ fontSize: 13, margin: 0 }}>Nenhum motorista online</p>
                                </div>
                            ) : (
                                drivers.map((driver, i) => (
                                    <div
                                        key={driver.id}
                                        onClick={() => setSelectedDriver(driver)}
                                        style={{
                                            padding: '12px 18px',
                                            borderBottom: i < drivers.length - 1 ? '1px solid #f8fafc' : 'none',
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            cursor: 'pointer',
                                            background: selectedDriver?.id === driver.id ? '#fff8fb' : 'transparent',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                                        onMouseLeave={e => e.currentTarget.style.background = selectedDriver?.id === driver.id ? '#fff8fb' : 'transparent'}
                                    >
                                        <div style={{
                                            width: 36, height: 36, borderRadius: '50%',
                                            background: `${STATUS_COLOR[driver.status] || '#e91e63'}22`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: STATUS_COLOR[driver.status] || '#e91e63',
                                            flexShrink: 0, position: 'relative'
                                        }}>
                                            <Bike size={16} />
                                            <div style={{
                                                position: 'absolute', bottom: 0, right: 0,
                                                width: 10, height: 10, borderRadius: '50%',
                                                background: STATUS_COLOR[driver.status] || '#e91e63',
                                                border: '2px solid #fff'
                                            }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#0f172a', truncate: true }}>{driver.full_name}</p>
                                            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                                                {locationByDriverId.get(driver.id)?.position
                                                    ? `📍 ${locationByDriverId.get(driver.id).position.map(value => value.toFixed(4)).join(', ')} · ${locationByDriverId.get(driver.id).state === 'stale' ? `desatualizada ${formatLocationAge(locationByDriverId.get(driver.id).ageMs)}` : locationByDriverId.get(driver.id).state === 'fresh' ? `atualizada ${formatLocationAge(locationByDriverId.get(driver.id).ageMs)}` : 'hora desconhecida'}`
                                                    : '📍 Localização desconhecida'}
                                            </p>
                                        </div>
                                        <span style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: STATUS_COLOR[driver.status] || '#e91e63',
                                            flexShrink: 0,
                                            boxShadow: `0 0 0 3px ${STATUS_COLOR[driver.status] || '#e91e63'}33`
                                        }} />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Active Trips */}
                    <div className="live-ops-panel">
                        <div style={{ padding: '14px 18px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Activity size={18} style={{ color: '#3b82f6' }} />
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                                Corridas Activas ({activeTrips.length})
                            </h3>
                        </div>
                        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                            {errors.trips && <ResourceError message={errors.trips} onRetry={fetchData} />}
                            {loading ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>A carregar...</div>
                            ) : activeTrips.length === 0 && errors.trips ? null : activeTrips.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                                    <Car size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                                    <p style={{ fontSize: 13, margin: 0 }}>Nenhuma corrida activa</p>
                                </div>
                            ) : (
                                activeTrips.map((trip, i) => {
                                    const meta = TRIP_STATUS_META[trip.status] || { label: trip.status, color: '#94a3b8' }
                                    return (
                                        <div key={trip.id} style={{
                                            padding: '12px 18px',
                                            borderBottom: i < activeTrips.length - 1 ? '1px solid #f8fafc' : 'none'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                                                    #{trip.id.substring(0, 8).toUpperCase()}
                                                </span>
                                                <span style={{
                                                    background: `${meta.color}22`, color: meta.color,
                                                    padding: '2px 8px', borderRadius: 10,
                                                    fontSize: 10, fontWeight: 700
                                                }}>{meta.label}</span>
                                            </div>
                                            <p style={{ margin: '0 0 2px', fontSize: 12, color: '#0f172a', fontWeight: 600 }}>
                                                {trip.profiles_trips_client_idToprofiles?.full_name || 'Cliente'}
                                            </p>
                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e91e63', marginTop: 3, flexShrink: 0 }} />
                                                    <span style={{ lineHeight: 1.4 }}>{trip.origin_address || '—'}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', marginTop: 2 }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0f172a', marginTop: 3, flexShrink: 0 }} />
                                                    <span style={{ lineHeight: 1.4 }}>{trip.dest_address || '—'}</span>
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
        <div role="alert" style={{ padding: '12px 16px', background: '#fff7ed', color: '#9a3412', fontSize: 12 }}>
            <p style={{ margin: '0 0 8px' }}>{message}</p>
            <button type="button" onClick={onRetry} style={{ border: 0, padding: 0, background: 'transparent', color: '#c2410c', cursor: 'pointer', fontWeight: 700 }}>
                Tentar novamente
            </button>
        </div>
    )
}
