import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './Dashboard.css'
import { Menu, X, User, History, CreditCard, Settings, HelpCircle, LogOut, Home, Gift, CheckCircle, Navigation, MapPin, Clock, Star, FileText } from 'lucide-react'
import { io } from 'socket.io-client'
import { toast } from 'react-hot-toast'

const SOCKET_URL = 'http://localhost:3004'

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
    const socketRef = useRef(null)

    // ESTADOS DE FLUXO
    const [step, setStep] = useState('service_selection')
    // service_selection, vehicle_selection, destination_input, estimating, searching, accepted, ongoing, finished, paid

    const [serviceType, setServiceType] = useState(null)
    const [vehicleType, setVehicleType] = useState(null)

    const [userPos, setUserPos] = useState([-8.839, 13.289]) // Luanda
    const [destPos, setDestPos] = useState(null)
    const [originAddress, setOriginAddress] = useState('Localização atual')
    const [destAddress, setDestAddress] = useState('')

    const [rideInfo, setRideInfo] = useState({ distance: 0, duration: 0, price: 0 })
    const [acceptedDriver, setAcceptedDriver] = useState(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [receipt, setReceipt] = useState(null)

    const mapRef = useRef(null)
    const mapInstance = useRef(null)
    const originMarker = useRef(null)
    const destMarker = useRef(null)
    const polyline = useRef(null)
    const driverMarker = useRef(null)

    // 1. Inicializar Socket e Listeners
    useEffect(() => {
        if (user) {
            socketRef.current = io(SOCKET_URL)
            socketRef.current.on('connect', () => {
                socketRef.current.emit('join', { userId: user.id, role: 'client' })
            })

            socketRef.current.on('trip_accepted', (data) => {
                setAcceptedDriver(data.driver)
                setStep('accepted')
                toast.success(`Motorista ${data.driver.name} aceitou sua corrida!`, { icon: '🚕' })
            })

            socketRef.current.on('ride_started', () => {
                setStep('ongoing')
                toast.success('Sua viagem começou! Aproveite o trajeto.')
            })

            socketRef.current.on('trip_update', (data) => {
                const { currentFare, coords } = data
                setRideInfo(prev => ({ ...prev, price: currentFare }))

                // Mover marcador do motorista no mapa
                if (mapInstance.current && coords) {
                    const newLatLng = [coords.lat, coords.lng]
                    if (driverMarker.current) {
                        driverMarker.current.setLatLng(newLatLng)
                    } else {
                        driverMarker.current = L.marker(newLatLng, {
                            icon: L.divIcon({
                                html: '<div class="driver-marker-pulse">🚕</div>',
                                className: 'custom-div-icon'
                            })
                        }).addTo(mapInstance.current)
                    }
                }
            })

            socketRef.current.on('ride_finished', (data) => {
                setStep('finished')
                setRideInfo(prev => ({ ...prev, price: data.finalFare }))
                toast('Chegada ao destino! Aguarde a confirmação de pagamento do motorista.', { icon: '📍' })
            })

            socketRef.current.on('payment_confirmed', (data) => {
                setReceipt(data.receiptData)
                setStep('paid')
                toast.success('Pagamento confirmado! Veja seu recibo.', { icon: '🧾' })
            })

            return () => {
                if (socketRef.current) socketRef.current.disconnect()
            }
        }
    }, [user])

    // 2. Inicializar Mapa (Simplificado para o walkthrough)
    useEffect(() => {
        if (!mapInstance.current && mapRef.current) {
            mapInstance.current = L.map(mapRef.current, { center: userPos, zoom: 15, zoomControl: false, attributionControl: false })
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current)
            originMarker.current = L.marker(userPos, { icon: DefaultIcon }).addTo(mapInstance.current)
        }
    }, [])

    const handleRequestRide = () => {
        if (socketRef.current) {
            const tripData = {
                id: 'TX-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
                clientId: user.id,
                userName: user.full_name,
                originAddress,
                destAddress,
                price: rideInfo.price,
                type: vehicleType === 'moto' ? 'Moto' : 'Carro'
            }
            socketRef.current.emit('request_trip', tripData)
            setStep('searching')
        }
    }

    const resetFlow = () => {
        setStep('service_selection')
        setAcceptedDriver(null)
        setReceipt(null)
        setRideInfo({ distance: 0, duration: 0, price: 0 })
        if (driverMarker.current) driverMarker.current.remove()
        driverMarker.current = null
    }

    return (
        <div className="dashboard-container">
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
                    <button className="nav-item active"><Home size={20} /> <span>Ínicio</span></button>
                    <button className="nav-item"><History size={20} /> <span>Minhas Viagens</span></button>
                    <button className="nav-item" onClick={signOut}><LogOut size={20} /> <span>Sair</span></button>
                </nav>
            </aside>

            <header className="dashboard-header">
                <button className="btn-menu" onClick={() => setIsSidebarOpen(true)}><Menu size={24} color="#1e293b" /></button>
                <h1 className="logo-small">TOT</h1>
                <div className="header-spacer"></div>
            </header>

            <main className="dashboard-content">
                <div className="welcome-banner">
                    {step === 'ongoing' || step === 'finished' ? (
                        <div className="live-fare-header">
                            <span className="live-label">PREÇO ATUAL</span>
                            <span className="live-value">Kz {rideInfo.price.toLocaleString()}</span>
                        </div>
                    ) : (
                        <>
                            <h2>Olá, {user?.full_name?.split(' ')[0]}!</h2>
                            <p>{step === 'service_selection' ? 'O que você precisa hoje?' : 'Acompanhe sua solicitação.'}</p>
                        </>
                    )}
                </div>

                <div className={`map-area ${step}`}>
                    <div id="map" ref={mapRef}></div>

                    {step === 'accepted' && acceptedDriver && (
                        <div className="price-card-overlay active animate-slide-up">
                            <div className="driver-on-way-card">
                                <div className="driver-header-premium">
                                    <div className="driver-avatar-ring">
                                        <div className="avatar-main">{acceptedDriver.name[0]}</div>
                                        <div className="status-dot"></div>
                                    </div>
                                    <div className="driver-info-main">
                                        <div className="driver-name-row">
                                            <h4>{acceptedDriver.name}</h4>
                                            <span className="rating-pill">★ 4.9</span>
                                        </div>
                                        <p>Seu motorista TOT está a caminho!</p>
                                    </div>
                                    <div className="check-success"><CheckCircle size={28} color="#E91E63" fill="rgba(233, 30, 99, 0.1)" /></div>
                                </div>
                                <div className="driver-actions-grid">
                                    <button className="btn-action-premium pink-glow"><Clock size={16} /> Mensagem</button>
                                    <button className="btn-action-premium glass" onClick={resetFlow}>Cancelar</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'paid' && receipt && (
                        <div className="price-card-overlay active animate-slide-up">
                            <div className="concluded-ride-card">
                                <div className="concluded-header">
                                    <div className="check-ring"><CheckCircle size={40} color="#E91E63" /></div>
                                    <h3>VIAGEM CONCLUÍDA!</h3>
                                    <p>Obrigado por viajar com a TOT.</p>
                                </div>
                                <div className="receipt-summary-mini">
                                    <div className="summary-row"><span>Total Pago</span><strong>Kz {receipt.total.toLocaleString()}</strong></div>
                                    <div className="summary-row"><span>Data</span><span>{receipt.date}</span></div>
                                </div>
                                <div className="rating-area">
                                    <p>Como foi sua experiência?</p>
                                    <div className="stars-row"><Star fill="#ffb800" color="#ffb800" /><Star fill="#ffb800" color="#ffb800" /><Star fill="#ffb800" color="#ffb800" /><Star fill="#ffb800" color="#ffb800" /><Star color="#cbd5e1" /></div>
                                </div>
                                <div className="driver-actions-grid">
                                    <button className="btn-action-premium pink-glow"><FileText size={16} /> VER RECIBO</button>
                                    <button className="btn-action-premium glass" onClick={resetFlow}>INÍCIO</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {step === 'service_selection' && (
                    <div className="selection-box-floating row">
                        <div className="service-card shadow-lg pink" onClick={() => { setServiceType('ride'); setStep('destination_input'); }}>
                            <div className="icon">🏎️</div>
                            <h3>Corrida</h3>
                        </div>
                        <div className="service-card shadow-lg white" onClick={() => { setServiceType('delivery'); setStep('destination_input'); }}>
                            <div className="icon">📦</div>
                            <h3>Entrega</h3>
                        </div>
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
