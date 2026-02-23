import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './Dashboard.css'
import { Menu, X, User, History, CreditCard, Settings, HelpCircle, LogOut, Home, Gift, CheckCircle, Navigation, MapPin, Clock, Star, FileText, Package, Truck, Bike, Car, ChevronRight, Info } from 'lucide-react'
import { io } from 'socket.io-client'
import { toast } from 'react-hot-toast'
import { geocodingService } from '../services/geocodingService'
import { routingService } from '../services/routingService'

const SOCKET_URL = 'http://localhost:3004'
const ADMIN_API_URL = 'http://localhost:3000/admin'

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

export default function Dashboard({ onNavigate }) {
    const { user, signOut } = useAuth()
    const socketRef = useRef(null)

    // ESTADOS DE FLUXO
    const [step, setStep] = useState('service_selection')
    // service_selection, sub_service_selection, destination_input, delivery_details, estimating, searching, accepted, ongoing, finished, paid

    const [availableServices, setAvailableServices] = useState([])
    const [selectedCategory, setSelectedCategory] = useState(null) // 'ride' or 'delivery'
    const [selectedService, setSelectedService] = useState(null) // selected config object

    const [userPos, setUserPos] = useState({ lat: -8.839, lng: 13.289 }) // Luanda
    const [destPos, setDestPos] = useState(null)
    const [originAddress, setOriginAddress] = useState('Localização atual')
    const [destAddress, setDestAddress] = useState('')
    const [tripData, setTripData] = useState({}) // Para armazenar ID da trip atual

    const [deliveryInfo, setDeliveryInfo] = useState({
        recipientName: '',
        recipientPhone: '',
        packageDescription: '',
        instructions: ''
    })

    const [rideInfo, setRideInfo] = useState({ distance: 0, duration: 0, price: 0 })
    const [acceptedDriver, setAcceptedDriver] = useState(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [receipt, setReceipt] = useState(null)
    const [isRequestingTrip, setIsRequestingTrip] = useState(false)

    const mapRef = useRef(null)
    const mapInstance = useRef(null)
    const originMarker = useRef(null)
    const destMarker = useRef(null)
    const polyline = useRef(null)
    const driverMarker = useRef(null)
    const routePolyline = useRef(null) // New ref for route

    // Autocomplete State
    const [addressSuggestions, setAddressSuggestions] = useState([])
    const [isSearchingAddress, setIsSearchingAddress] = useState(false)

    // 1. Fetch Services & WebSocket setup
    useEffect(() => {
        fetchServices()

        if (user) {
            socketRef.current = io(SOCKET_URL)
            socketRef.current.on('connect', () => {
                socketRef.current.emit('join', { userId: user.id, role: 'client' })
            })

            socketRef.current.on('trip_accepted', (data) => {
                setStep('accepted')
                setAcceptedDriver(data.driver)
                setTripData(prev => ({ ...prev, tripId: data.tripId }))
                toast.success(`Motorista ${data.driver.name} aceitou!`, { icon: '🚕' })
            })

            socketRef.current.on('restore_trip', (trip) => {
                setTripData(prev => ({ ...prev, tripId: trip.id }))
                if (trip.status === 'requested') {
                    setStep('searching')
                    setDestAddress(trip.destAddress || trip.dest_address)
                    setOriginAddress(trip.pickupAddress || trip.origin_address)
                    setRideInfo(prev => ({ ...prev, price: trip.price || trip.estimated_fare }))
                } else if (trip.status === 'accepted') {
                    setStep('accepted')
                    setAcceptedDriver({ id: trip.driver_id, name: trip.driver_name })
                } else if (trip.status === 'ongoing') {
                    setStep('ongoing')
                    setAcceptedDriver({ id: trip.driver_id, name: trip.driver_name || 'Motorista' })
                    if (trip.current_fare) setRideInfo(prev => ({ ...prev, price: trip.current_fare }))
                }
            })

            socketRef.current.on('trip_cancelled_confirmed', () => {
                resetFlow()
                toast.success('Corrida cancelada!', { icon: '✅' })
            })

            socketRef.current.on('trip_cancelled', () => {
                resetFlow()
                toast.error('O motorista cancelou a corrida.', { icon: '🚫' })
            })

            socketRef.current.on('ride_started', () => {
                setStep('ongoing')
                toast.success('Sua viagem começou!')
            })

            socketRef.current.on('trip_update', (data) => {
                const { currentFare, coords } = data
                setRideInfo(prev => ({ ...prev, price: currentFare }))
                if (mapInstance.current && coords) {
                    const newLatLng = [coords.lat, coords.lng]

                    if (driverMarker.current) {
                        // Smooth transition handled by Leaflet or CSS usually,
                        // simpler here: just setLatLng.
                        driverMarker.current.setLatLng(newLatLng)

                        // Rotacionar ícone se houver direção (opcional, requer histórico de pontos)
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
                toast('Chegada ao destino!', { icon: '📍' })
            })

            socketRef.current.on('payment_confirmed', (data) => {
                setReceipt(data.receiptData)
                setStep('paid')
                toast.success('Pagamento confirmado!', { icon: '🧾' })
            })

            socketRef.current.on('trip_created', (data) => {
                setTripData(prev => ({ ...prev, tripId: data.tripId }))
            })

            socketRef.current.on('trip_timeout', (data) => {
                resetFlow()
                toast.error(data.message || 'Nenhum motorista disponível.', { icon: '⏱️' })
            })

            return () => {
                if (socketRef.current) socketRef.current.disconnect()
            }
        }
    }, [user])

    // 2. Map & Geolocation
    useEffect(() => {
        if (!mapInstance.current && mapRef.current) {
            mapInstance.current = L.map(mapRef.current, { center: [userPos.lat, userPos.lng], zoom: 15, zoomControl: false, attributionControl: false })

            // MapTiler Layer (Real, Professional Map)
            const mapTilerKey = import.meta.env.VITE_MAPTILER_API_KEY || 'FC7t7sY7TUYYNWQ2VstA'
            L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`, {
                tileSize: 512,
                zoomOffset: -1,
                attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
                crossOrigin: true
            }).addTo(mapInstance.current)

            originMarker.current = L.marker([userPos.lat, userPos.lng], { icon: DefaultIcon }).addTo(mapInstance.current)
        }
    }, [userPos]) // Depend on userPos to initialize map correctly

    // GPS REAL: Hard Lock
    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords
                    const newPos = { lat: latitude, lng: longitude }
                    setUserPos(newPos)

                    if (mapInstance.current) {
                        mapInstance.current.setView([latitude, longitude], 16)
                        if (originMarker.current) originMarker.current.setLatLng([latitude, longitude])
                    }

                    // Reverse Geocoding via MapTiler (Real Address)
                    try {
                        const address = await geocodingService.reverseGeocode(latitude, longitude)
                        if (address) setOriginAddress(address)
                    } catch (e) {
                        console.error("Inverse Geocoding Error:", e)
                    }
                },
                (error) => console.error('GPS Error:', error),
                { enableHighAccuracy: true }
            )
        }
    }, [])

    // Autocomplete Search Debouncer
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (step === 'destination_input' && destAddress.length > 2 && !tripData.destinationCoords) {
                setIsSearchingAddress(true)
                try {
                    const results = await geocodingService.searchAddress(destAddress, { lng: userPos.lng, lat: userPos.lat })
                    setAddressSuggestions(results)
                } catch (e) {
                    console.error(e)
                } finally {
                    setIsSearchingAddress(false)
                }
            } else {
                setAddressSuggestions([])
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [destAddress, step, userPos])

    const fetchServices = async () => {
        try {
            const response = await fetch(`${ADMIN_API_URL}/configs`)
            if (response.ok) {
                const data = await response.json()
                setAvailableServices(data)
            } else {
                console.error('Failed to fetch services')
            }
        } catch (error) {
            console.error('Error fetching services:', error)
        }
    }

    const handleSelectSuggestion = async (place) => {
        setDestAddress(place.text)
        setAddressSuggestions([])

        const destCoords = { lat: place.center[1], lng: place.center[0] }
        setDestPos([destCoords.lat, destCoords.lng])

        setTripData(prev => ({
            ...prev,
            destination: place.text,
            destinationCoords: destCoords
        }))

        if (mapInstance.current) {
            if (destMarker.current) destMarker.current.setLatLng([destCoords.lat, destCoords.lng])
            else destMarker.current = L.marker([destCoords.lat, destCoords.lng], { icon: DestIcon }).addTo(mapInstance.current)

            if (userPos) {
                const route = await routingService.getRoute(
                    { lat: userPos.lat, lng: userPos.lng },
                    destCoords
                )

                if (route) {
                    if (polyline.current) polyline.current.remove()
                    if (routePolyline.current) routePolyline.current.remove()

                    routePolyline.current = L.polyline(route.geometry, { color: '#E91E63', weight: 4 }).addTo(mapInstance.current)
                    mapInstance.current.fitBounds(routePolyline.current.getBounds(), { padding: [50, 50] })

                    // Pricing
                    if (selectedService) {
                        const base = Number(selectedService.base_fare || 500)
                        const perKm = Number(selectedService.price_per_km || 200)
                        const minFare = Number(selectedService.min_fare || 1000)

                        let price = Math.round(base + (route.distanceKm * perKm))
                        if (price < minFare) price = minFare

                        setRideInfo({
                            distance: route.distanceKm,
                            duration: route.durationMin,
                            price
                        })
                    }

                    if (selectedCategory === 'delivery') setStep('delivery_details')
                    else setStep('estimating')
                }
            }
        }
    }

    const handleSetDestination = async (e) => {
        if (e.key === 'Enter' && destAddress.length > 3) {
            // REAL LOGIC: Search API and pick first result
            setIsSearchingAddress(true)
            try {
                const results = await geocodingService.searchAddress(destAddress, { lat: userPos.lat, lng: userPos.lng })

                if (results && results.length > 0) {
                    // Automatically select the best match
                    await handleSelectSuggestion(results[0])
                } else {
                    toast.error('Endereço não encontrado.')
                }
            } catch (err) {
                console.error("Search Error:", err)
                toast.error('Erro ao buscar endereço.')
            } finally {
                setIsSearchingAddress(false)
            }
        }
    }

    const handleRequestRide = () => {
        if (isRequestingTrip) return
        if (socketRef.current) {
            setIsRequestingTrip(true)
            const tripPayload = {
                clientId: user.id,
                userName: user.full_name,
                originAddress,
                destAddress,
                price: rideInfo.price,
                serviceConfigId: selectedService.id,
                category: selectedCategory, // 'ride' or 'delivery'
                deliveryInfo: selectedCategory === 'delivery' ? deliveryInfo : null,
                originLat: userPos.lat,
                originLng: userPos.lng,
                destLat: destPos[0],
                destLng: destPos[1]
            }
            socketRef.current.emit('request_trip', tripPayload)
            setStep('searching')
            setTimeout(() => setIsRequestingTrip(false), 2000)
        }
    }

    const handleCancelRide = () => {
        if (socketRef.current && tripData.tripId) {
            socketRef.current.emit('cancel_trip', { tripId: tripData.tripId })
        }
        resetFlow()
        toast('Solicitação cancelada.', { icon: '🚫' })
    }

    const resetFlow = () => {
        setStep('service_selection')
        setAcceptedDriver(null)
        setReceipt(null)
        setRideInfo({ distance: 0, duration: 0, price: 0 })
        if (driverMarker.current) driverMarker.current.remove()
        driverMarker.current = null
        setTripData({})
        setSelectedService(null)
        setSelectedCategory(null)
    }

    const filteredServices = availableServices.filter(s => s.category === selectedCategory)

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
                    <button className="nav-item active" onClick={() => setIsSidebarOpen(false)}><Home size={22} /><span>Início</span></button>
                    <button className="nav-item" onClick={() => { onNavigate('history'); setIsSidebarOpen(false); }}><History size={22} /><span>Minhas Viagens</span></button>
                    <button className="nav-item" onClick={signOut}><LogOut size={22} /><span>Sair</span></button>
                </nav>
            </aside>

            <header className="dashboard-header">
                <button className="btn-menu" onClick={() => setIsSidebarOpen(true)}><Menu size={24} color="#1e293b" /></button>
                <h1 className="logo-small">TOT</h1>
                <div className="header-spacer"></div>
            </header>

            <main className="dashboard-content">
                <div className="welcome-banner">
                    {['ongoing', 'finished'].includes(step) ? (
                        <div className="live-fare-header">
                            <span className="live-label">PREÇO ATUAL</span>
                            <span className="live-value">Kz {rideInfo.price.toLocaleString()}</span>
                        </div>
                    ) : (
                        <>
                            <h2>Olá, {user?.full_name?.split(' ')[0]}!</h2>
                            <p>
                                {step === 'service_selection' && 'O que você precisa hoje?'}
                                {step === 'sub_service_selection' && 'Qual modalidade prefere?'}
                                {step === 'destination_input' && 'Para onde vamos?'}
                                {step === 'delivery_details' && 'Detalhes da entrega'}
                                {step === 'estimating' && 'Resumo da solicitação'}
                                {step === 'searching' && 'Buscando motorista...'}
                                {step === 'accepted' && 'Um TOT está a caminho!'}
                                {step === 'paid' && 'Viagem concluída com sucesso.'}
                            </p>
                            {step === 'sub_service_selection' && <button className="back-link" onClick={() => setStep('service_selection')}>Escolher categoria</button>}
                            {step === 'destination_input' && <button className="back-link" onClick={() => setStep('sub_service_selection')}>Alterar modalidade</button>}
                            {step === 'delivery_details' && <button className="back-link" onClick={() => setStep('destination_input')}>Corrigir destino</button>}
                            {step === 'estimating' && <button className="back-link" onClick={() => selectedCategory === 'delivery' ? setStep('delivery_details') : setStep('destination_input')}>Corrigir informações</button>}
                        </>
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
                            {step === 'destination_input' && (
                                <div className="address-row border-top">
                                    <span className="dot destination"></span>
                                    <input
                                        type="text"
                                        placeholder="Pesquise o destino..."
                                        value={destAddress}
                                        onChange={(e) => setDestAddress(e.target.value)}
                                        onKeyDown={handleSetDestination}
                                        autoFocus
                                    />
                                </div>
                            )}
                            {step !== 'destination_input' && destAddress && (
                                <div className="address-row border-top">
                                    <span className="dot destination"></span>
                                    <input type="text" value={destAddress} readOnly />
                                </div>
                            )}

                            {/* Autocomplete List */}
                            {step === 'destination_input' && addressSuggestions.length > 0 && (
                                <ul className="suggestions-list animate-slide-up">
                                    {addressSuggestions.map(place => (
                                        <li key={place.id} onClick={() => handleSelectSuggestion(place)} className="suggestion-item">
                                            <div className="suggestion-icon"><MapPin size={16} /></div>
                                            <div className="suggestion-text">
                                                <strong>{place.text}</strong>
                                                <small>{place.place_name}</small>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {step === 'delivery_details' && (
                        <div className="price-card-overlay active animate-slide-up delivery-form-card">
                            <div className="delivery-form">
                                <div className="input-group-client">
                                    <label>Nome do Destinatário</label>
                                    <input
                                        type="text"
                                        placeholder="Quem recebe?"
                                        value={deliveryInfo.recipientName}
                                        onChange={e => setDeliveryInfo({ ...deliveryInfo, recipientName: e.target.value })}
                                    />
                                </div>
                                <div className="input-group-client">
                                    <label>Telefone do Destinatário</label>
                                    <input
                                        type="tel"
                                        placeholder="Telefone de contato"
                                        value={deliveryInfo.recipientPhone}
                                        onChange={e => setDeliveryInfo({ ...deliveryInfo, recipientPhone: e.target.value })}
                                    />
                                </div>
                                <div className="input-group-client">
                                    <label>O que está a enviar?</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Documentos, Comida, Chaves"
                                        value={deliveryInfo.packageDescription}
                                        onChange={e => setDeliveryInfo({ ...deliveryInfo, packageDescription: e.target.value })}
                                    />
                                </div>
                                <button className="confirm-btn mt-4" onClick={() => setStep('estimating')}>CONTINUAR</button>
                            </div>
                        </div>
                    )}

                    {step === 'estimating' && (
                        <div className="price-card-overlay active animate-slide-up">
                            <div className="ride-summary">
                                <div className="service-info-mini">
                                    <div className="icon-mini pink-gradient shadow">
                                        {selectedService.category === 'delivery' ? <Package size={14} /> : (selectedService.vehicle_category === 'moto' ? <Bike size={14} /> : <Car size={14} />)}
                                    </div>
                                    <div>
                                        <h4>{selectedService.name}</h4>
                                        <p>{selectedService.vehicle_category.toUpperCase()}</p>
                                    </div>
                                </div>
                                <div className="detail-item price-main">
                                    <span className="label">Total Estimado</span>
                                    <span className="val">Kz {rideInfo.price.toLocaleString()}</span>
                                </div>
                                {selectedCategory === 'delivery' && (
                                    <div className="delivery-summary-box">
                                        <p><strong>Destinatário:</strong> {deliveryInfo.recipientName}</p>
                                        <p><strong>Conteúdo:</strong> {deliveryInfo.packageDescription}</p>
                                    </div>
                                )}
                            </div>
                            <button className="confirm-btn pulse" onClick={handleRequestRide}>
                                SOLICITAR AGORA
                            </button>
                        </div>
                    )}

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
                                    <div className="check-success"><CheckCircle size={28} color="#E91E63" /></div>
                                </div>
                                <div className="driver-actions-grid">
                                    <button className="btn-action-premium pink-glow">Mensagem</button>
                                    <button className="btn-action-premium glass" onClick={handleCancelRide}>Cancelar</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'paid' && receipt && (
                        <div className="price-card-overlay active animate-slide-up">
                            <div className="concluded-ride-card">
                                <div className="concluded-header">
                                    <div className="check-ring"><CheckCircle size={40} color="#E91E63" /></div>
                                    <h3>CONCLUÍDO!</h3>
                                    <p>Obrigado por usar a TOT.</p>
                                </div>
                                <div className="receipt-summary-mini">
                                    <div className="summary-row"><span>Total Pago</span><strong>Kz {receipt.total.toLocaleString()}</strong></div>
                                </div>
                                <button className="btn-action-premium pink-glow w-full" onClick={resetFlow}>FECHAR</button>
                            </div>
                        </div>
                    )}
                </div>

                {(step === 'service_selection' || step === 'sub_service_selection') && (
                    <div className="selection-box-floating row">
                        {step === 'service_selection' ? (
                            <>
                                <div className="service-card shadow-lg pink" onClick={() => { setSelectedCategory('ride'); setStep('sub_service_selection'); }}>
                                    <div className="icon">🏎️</div>
                                    <h3>Corrida</h3>
                                    <p>Para você viajar</p>
                                </div>
                                <div className="service-card shadow-lg white" onClick={() => { setSelectedCategory('delivery'); setStep('sub_service_selection'); }}>
                                    <div className="icon">📦</div>
                                    <h3>Entrega</h3>
                                    <p>Mande pacotes</p>
                                </div>
                            </>
                        ) : (
                            <div className="sub-services-list">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="sub-service-item animate-fade-in" onClick={() => { setSelectedService(service); setStep('destination_input'); }}>
                                        <div className="service-icon-box">
                                            {service.category === 'delivery' ? <Package size={20} /> : (service.vehicle_category === 'moto' ? <Bike size={24} /> : <Car size={24} />)}
                                        </div>
                                        <div className="service-text">
                                            <h4>{service.name}</h4>
                                            <p>{service.description || `Viagem de ${service.vehicle_category}`}</p>
                                        </div>
                                        <div className="service-price-hint">
                                            <span>Desde</span>
                                            <strong>Kz {Number(service.min_fare).toLocaleString()}</strong>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-300" />
                                    </div>
                                ))}
                                {filteredServices.length === 0 && (
                                    <div className="no-services text-center py-4">
                                        <Info size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-sm text-slate-500">Nenhum serviço disponível nesta categoria no momento.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {step === 'searching' && (
                    <div className="searching-overlay full">
                        <div className="radar-ping"></div>
                        <h3>Procurando Driver...</h3>
                        <p>A conectar ao TOT mais próximo para sua {selectedCategory === 'delivery' ? 'entrega' : 'viagem'}.</p>
                        <button className="cancel-btn-round" onClick={handleCancelRide}>✕</button>
                    </div>
                )}
            </main>
        </div>
    )
}
