import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './Dashboard.css'

// Fix para ícones do Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
})

const DestIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    className: 'destination-marker-icon'
})

export default function Dashboard() {
    const { user, signOut } = useAuth()

    // ESTADOS DE FLUXO
    const [step, setStep] = useState('service_selection')
    const [serviceType, setServiceType] = useState(null)
    const [vehicleType, setVehicleType] = useState(null)

    const [userPos, setUserPos] = useState([-8.839, 13.289]) // Luanda
    const [destPos, setDestPos] = useState(null)
    const [originAddress, setOriginAddress] = useState('Localização atual')
    const [destAddress, setDestAddress] = useState('')

    const [rideInfo, setRideInfo] = useState({ distance: 0, duration: 0, price: 0 })

    const mapRef = useRef(null)
    const mapInstance = useRef(null)
    const originMarker = useRef(null)
    const destMarker = useRef(null)
    const polyline = useRef(null)

    // 1. Inicializar Mapa (Nativo)
    useEffect(() => {
        if (!mapInstance.current && mapRef.current) {
            mapInstance.current = L.map(mapRef.current, {
                center: userPos,
                zoom: 15,
                zoomControl: false,
                attributionControl: false
            })
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current)
            originMarker.current = L.marker(userPos, { icon: DefaultIcon }).addTo(mapInstance.current)
        }
    }, [])

    // 2. Geolocation Inicial
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords
                    const newPos = [latitude, longitude]
                    setUserPos(newPos)
                    if (mapInstance.current) {
                        mapInstance.current.setView(newPos, 16)
                        if (originMarker.current) originMarker.current.setLatLng(newPos)
                    }

                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
                        if (res.ok) {
                            const data = await res.json()
                            setOriginAddress(data.display_name.split(',').slice(0, 2).join(', '))
                        }
                    } catch (e) { }
                },
                null,
                { enableHighAccuracy: true }
            )
        }
    }, [])

    const handleSetDestination = (e) => {
        if (e.key === 'Enter' && destAddress.length > 3) {
            const offsetLat = (Math.random() - 0.5) * 0.05
            const offsetLon = (Math.random() - 0.5) * 0.05
            const newDest = [userPos[0] + offsetLat, userPos[1] + offsetLon]
            setDestPos(newDest)

            if (mapInstance.current) {
                if (destMarker.current) destMarker.current.setLatLng(newDest)
                else destMarker.current = L.marker(newDest, { icon: DestIcon }).addTo(mapInstance.current)

                if (polyline.current) polyline.current.remove()
                polyline.current = L.polyline([userPos, newDest], { color: '#E91E63', weight: 4, dashArray: '10, 10' }).addTo(mapInstance.current)

                mapInstance.current.fitBounds(L.latLngBounds([userPos, newDest]), { padding: [80, 80] })
            }

            const dist = (L.latLng(userPos).distanceTo(L.latLng(newDest)) / 1000).toFixed(1)
            const duration = Math.round(dist * 2.5)
            const base = serviceType === 'delivery' ? 400 : (vehicleType === 'moto' ? 200 : 500)
            const perKm = vehicleType === 'moto' ? 150 : 300
            const price = Math.round(base + (dist * perKm))

            setRideInfo({ distance: dist, duration, price })
            setStep('estimating')
        }
    }

    const resetFlow = () => {
        setStep('service_selection')
        setServiceType(null)
        setVehicleType(null)
        setDestPos(null)
        setDestAddress('')
        if (destMarker.current) destMarker.current.remove()
        if (polyline.current) polyline.current.remove()
        destMarker.current = null
        polyline.current = null
        if (mapInstance.current) mapInstance.current.setView(userPos, 16)
    }

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1 className="logo-small">TOT</h1>
                <button onClick={signOut} className="btn-logout">Sair</button>
            </header>

            <main className="dashboard-content">
                <div className="welcome-banner">
                    <h2>Olá, {user?.full_name || 'Usuário'}!</h2>
                    <p>
                        {step === 'service_selection' && 'O que você precisa hoje?'}
                        {step === 'vehicle_selection' && 'Escolha o transporte'}
                        {step === 'destination_input' && 'Para onde vamos?'}
                        {step === 'estimating' && 'Resumo da solicitação'}
                        {step === 'searching' && 'Buscando motorista...'}
                    </p>
                    {step === 'vehicle_selection' && (
                        <button className="back-link" onClick={() => setStep('service_selection')}>Escolher outro serviço</button>
                    )}
                </div>

                <div className={`map-area ${step}`}>
                    <div id="map" ref={mapRef}></div>

                    <div className="map-overlay-top">
                        <div className="address-card shadow">
                            <div className="address-row">
                                <span className="dot origin"></span>
                                <input type="text" value={originAddress} readOnly />
                            </div>
                            {(step === 'destination_input' || step === 'estimating') && (
                                <div className="address-row border-top">
                                    <span className="dot destination"></span>
                                    <input
                                        type="text"
                                        placeholder="Digite o destino e aperte Enter"
                                        value={destAddress}
                                        onChange={(e) => setDestAddress(e.target.value)}
                                        onKeyDown={handleSetDestination}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {step === 'estimating' && (
                        <div className="price-card-overlay active">
                            <div className="ride-summary">
                                <div className="detail-item">
                                    <span className="label">Distância</span>
                                    <span className="val">{rideInfo.distance} KM</span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">Tempo</span>
                                    <span className="val">{rideInfo.duration} min</span>
                                </div>
                                <div className="detail-item price-main">
                                    <span className="label">Total</span>
                                    <span className="val">Kz {rideInfo.price.toLocaleString()}</span>
                                </div>
                            </div>
                            <button className="confirm-btn pulse" onClick={() => setStep('searching')}>
                                CONFIRMAR {serviceType === 'delivery' ? 'ENTREGA' : 'CORRIDA'}
                            </button>
                            <button className="cancel-link" onClick={() => setStep('destination_input')}>Alterar Destino</button>
                        </div>
                    )}
                </div>

                {/* BOTÕES DE SELEÇÃO - POSIÇÃO FIXA */}
                {(step === 'service_selection' || step === 'vehicle_selection') && (
                    <div className="selection-box-floating row">
                        {step === 'service_selection' ? (
                            <>
                                <div className="service-card shadow-lg pink" onClick={() => { setServiceType('ride'); setStep('vehicle_selection'); }}>
                                    <div className="icon">🏎️</div>
                                    <h3>Corrida</h3>
                                </div>
                                <div className="service-card shadow-lg white" onClick={() => { setServiceType('delivery'); setStep('vehicle_selection'); }}>
                                    <div className="icon">📦</div>
                                    <h3>Entrega</h3>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="service-card shadow-lg pink" onClick={() => { setVehicleType('moto'); setStep('destination_input'); }}>
                                    <div className="icon">🏍️</div>
                                    <h3>Moto</h3>
                                </div>
                                <div className="service-card shadow-lg white" onClick={() => { setVehicleType('car'); setStep('destination_input'); }}>
                                    <div className="icon">🚗</div>
                                    <h3>Carro</h3>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {step === 'searching' && (
                    <div className="searching-overlay full">
                        <div className="radar-ping"></div>
                        <h3>Procurando Driver...</h3>
                        <p>A conectar ao TOT mais próximo de você.</p>
                        <button className="cancel-btn-round" onClick={resetFlow}>✕</button>
                    </div>
                )}
            </main>
        </div>
    )
}
