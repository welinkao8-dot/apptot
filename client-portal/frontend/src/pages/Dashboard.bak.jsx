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

export default function Dashboard() {
    const { user, signOut } = useAuth()
    const [step, setStep] = useState('selection')
    const [userPos, setUserPos] = useState([-8.839, 13.289]) // Luanda
    const [address, setAddress] = useState('Detectando sua localização...')
    const [rideInfo, setRideInfo] = useState({ distance: 0, price: 0, type: 'moto' })

    const mapRef = useRef(null)
    const mapInstance = useRef(null)
    const markerInstance = useRef(null)

    // 1. Inicializar Mapa (Nativo)
    useEffect(() => {
        if (!mapInstance.current && mapRef.current) {
            mapInstance.current = L.map(mapRef.current, {
                center: userPos,
                zoom: 16,
                zoomControl: false,
                attributionControl: false
            })

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current)

            markerInstance.current = L.marker(userPos, { icon: DefaultIcon }).addTo(mapInstance.current)
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove()
                mapInstance.current = null
            }
        }
    }, [])

    // 2. Geolocation e Endereço
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords
                    const newPos = [latitude, longitude]
                    setUserPos(newPos)

                    if (mapInstance.current) {
                        mapInstance.current.setView(newPos, 16)
                        if (markerInstance.current) markerInstance.current.setLatLng(newPos)
                    }

                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
                        if (res.ok) {
                            const data = await res.json()
                            setAddress(data.display_name.split(',').slice(0, 2).join(', '))
                        }
                    } catch (e) {
                        setAddress('Localização detectada')
                    }
                },
                () => setAddress('Luanda, Angola'),
                { enableHighAccuracy: true }
            )
        }
    }, [])

    const handleSimulateRide = (type) => {
        const dist = (Math.random() * 8 + 1).toFixed(1)
        const price = type === 'moto' ? 200 + (dist * 150) : 500 + (dist * 300)
        setRideInfo({ distance: dist, price, type })
        setStep('estimating')
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
                    <p>{step === 'selection' ? 'Pronto para partir?' : 'Confirmar sua corrida'}</p>
                </div>

                <div className={`map-area ${step}`}>
                    {/* DIV DO MAPA REAL (NATIVO) */}
                    <div id="map" ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }}></div>

                    <div className="map-overlay-top">
                        <div className="address-bar shadow">
                            <div className="dot from"></div>
                            <input type="text" value={address} readOnly />
                        </div>
                    </div>

                    {step === 'estimating' && (
                        <div className="price-card-overlay active">
                            <div className="ride-details">
                                <span className="type">{rideInfo.type === 'moto' ? '🏍️ Moto Táxi' : '🚗 Expresso'}</span>
                                <span className="price">Kz {rideInfo.price.toLocaleString()}</span>
                            </div>
                            <p className="dist">Distância estimada: {rideInfo.distance} KM</p>
                            <button className="confirm-btn" onClick={() => setStep('searching')}>
                                SOLICITAR {rideInfo.type.toUpperCase()}
                            </button>
                            <button className="cancel-link" onClick={() => setStep('selection')}>Mudar trajeto</button>
                        </div>
                    )}
                </div>

                {step === 'selection' && (
                    <div className="selection-box-floating">
                        <div className="service-card pink shadow-lg" onClick={() => handleSimulateRide('moto')}>
                            <div className="icon">🏍️</div>
                            <h3>MOTO</h3>
                        </div>
                        <div className="service-card white shadow-lg" onClick={() => handleSimulateRide('expresso')}>
                            <div className="icon">🚗</div>
                            <h3>CARRO</h3>
                        </div>
                    </div>
                )}

                {step === 'searching' && (
                    <div className="searching-overlay full">
                        <div className="radar-ping"></div>
                        <h3>Buscando motorista...</h3>
                        <p>Aguarde, conectando você ao TOT mais próximo.</p>
                        <button className="cancel-btn-round" onClick={() => setStep('selection')}>✕</button>
                    </div>
                )}
            </main>
        </div>
    )
}
