import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'
import { Menu, X, User, History, CreditCard, Settings, HelpCircle, LogOut, Home, Gift, CheckCircle, Navigation, MapPin, Clock, Star, FileText, Package, Truck, Bike, Car, ChevronRight, Info } from 'lucide-react'
import { io } from 'socket.io-client'
import { toast } from 'react-hot-toast'
import HereMap from '../components/HereMap'
import { hereGeocodingService } from '../services/hereGeocodingService'
import { hereRoutingService } from '../services/hereRoutingService'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3004'



export default function Dashboard({ onNavigate }) {
    const { user, signOut } = useAuth()
    const socketRef = useRef(null)
    const mapInstance = useRef(null)
    const platformRef = useRef(null)
    const uiRef = useRef(null)
    const markersRef = useRef({ origin: null, destination: null, driver: null, route: null })

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
    const [activeField, setActiveField] = useState(null); // 'origin' ou 'destination'

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

            socketRef.current.on('driver_location_update', (data) => {
                const { lat, lng } = data
                if (mapInstance.current) {
                    addMarker({ lat, lng }, 'driver');
                }
            })

            socketRef.current.on('trip_update', (data) => {
                const { currentFare, coords } = data
                setRideInfo(prev => ({ ...prev, price: currentFare }))
                if (mapInstance.current && coords) {
                    addMarker(coords, 'driver');
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

    // 2. Capturar Localização Inicial do GPS
    // 2. Capturar Localização Inicial do GPS
    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const coords = { lat: latitude, lng: longitude };
                    setUserPos(coords);

                    // 🔴 FIX: Adicionar marcador IMEDIATAMENTE
                    addMarker(coords, 'origin');

                    // Update Map if ready
                    if (mapInstance.current) {
                        mapInstance.current.setCenter(coords);
                    }

                    // Get Address
                    const address = await hereGeocodingService.reverseGeocode(latitude, longitude);
                    if (address) setOriginAddress(address);
                },
                (error) => {
                    console.log('GPS não disponível (normal em desktop):', error.message);
                    // Manter localização padrão de Luanda
                    // Adicionar marcador padrão
                    addMarker({ lat: -8.839, lng: 13.289 }, 'origin');
                },
                { enableHighAccuracy: true }
            );
        } else {
            // Fallback
            addMarker({ lat: -8.839, lng: 13.289 }, 'origin');
        }
    }, []);

    // 3. Debounce para Autocomplete de Destino
    useEffect(() => {
        console.log('🔍 Autocomplete Effect:', { destAddress, step, length: destAddress?.length });

        const timer = setTimeout(async () => {
            if (destAddress && destAddress.length > 3 && step === 'destination_input') {
                console.log('✅ Condições atendidas, buscando sugestões...');
                setIsSearchingAddress(true);
                const suggestions = await hereGeocodingService.fetchSuggestions(destAddress, userPos);
                console.log('📍 Sugestões recebidas:', suggestions);
                setAddressSuggestions(suggestions);
                setIsSearchingAddress(false);
            } else {
                console.log('❌ Condições não atendidas:', {
                    hasAddress: !!destAddress,
                    length: destAddress?.length,
                    isCorrectStep: step === 'destination_input'
                });
                setAddressSuggestions([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [destAddress, step]);







    // --- HELPERS PARA O MAPA ---
    const addMarker = (coords, type) => {
        if (!mapInstance.current) return;

        // Limpar marcador antigo se existir
        if (markersRef.current[type]) {
            mapInstance.current.removeObject(markersRef.current[type]);
        }

        const iconColors = {
            origin: '#3b82f6',
            destination: '#E91E63',
            driver: '#10b981'
        };

        const dotIcon = new window.H.map.DomIcon(`
            <div style="background: ${iconColors[type]}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>
        `);

        const marker = new window.H.map.DomMarker(coords, { icon: dotIcon });
        mapInstance.current.addObject(marker);
        markersRef.current[type] = marker;
    };

    const drawRoute = (geometry) => {
        if (!mapInstance.current) return;

        if (markersRef.current.route) {
            mapInstance.current.removeObject(markersRef.current.route);
        }

        const lineString = new window.H.geo.LineString();
        geometry.forEach(coord => {
            lineString.pushPoint({ lat: coord[0], lng: coord[1] });
        });

        const polyline = new window.H.map.Polyline(lineString, {
            style: { strokeColor: '#E91E63', lineWidth: 4, lineCap: 'round' }
        });

        mapInstance.current.addObject(polyline);
        markersRef.current.route = polyline;

        // Zooma para caber a rota
        mapInstance.current.getViewModel().setLookAtData({
            bounds: polyline.getBoundingBox()
        }, true);
    };

    const calculateFare = (distKm, durMin, service) => {
        if (!service) return 0;
        const base = parseFloat(service.base_fare || 0);
        const pKm = parseFloat(service.price_per_km || 0);
        const pMin = parseFloat(service.price_per_min || 0);
        const minFare = parseFloat(service.min_fare || 0);

        let total = base + (distKm * pKm) + (durMin * pMin);
        return Math.max(total, minFare);
    };

    // --- MANIPULADORES DE EVENTOS ---

    const handleSelectSuggestion = async (place) => {
        setAddressSuggestions([]);
        setIsSearchingAddress(false);
        setActiveField(null);

        let position = place.position;
        // Se a sugestão não tiver posição, buscamos os detalhes
        if (!position) {
            const details = await hereGeocodingService.geocode(place.title, userPos);
            if (details) position = { lat: details.lat, lng: details.lng };
        }

        if (position) {
            if (activeField === 'origin') {
                setOriginAddress(place.title);
                setUserPos({ lat: position.lat, lng: position.lng });
                addMarker(position, 'origin');
                if (mapInstance.current) mapInstance.current.setCenter(position);
            } else {
                setDestAddress(place.title);
                setDestPos([position.lat, position.lng]);
                setStep('delivery_details');
                addMarker(position, 'destination');

                // Se já temos a origem, desenhar a rota
                if (selectedCategory === 'ride') {
                    calculateRouteAndPrice(userPos, position);
                }
            }
        }
    };

    const handleAddressSubmit = async (e, field) => {
        if (e.key === 'Enter') {
            const query = field === 'origin' ? originAddress : destAddress;
            if (!query) return;

            // Se houver sugestões, pega a primeira
            if (addressSuggestions.length > 0) {
                handleSelectSuggestion(addressSuggestions[0]);
                return;
            }

            // Senão, busca direto
            setIsSearchingAddress(true);
            const coords = await hereGeocodingService.geocode(query, userPos);
            setIsSearchingAddress(false);

            if (coords) {
                const place = {
                    title: query,
                    address: query,
                    position: { lat: coords.lat, lng: coords.lng }
                };
                // Seta o activeField temporariamente para o handleSelect saber quem é
                // (embora já devíamos saber pelo argumento field, mas o handleSelect usa o state)
                // Vamos passar o activeField via state ou refatorar o handleSelect? 
                // O state activeField já deve estar setado pelo onFocus
                handleSelectSuggestion(place);
            } else {
                toast.error('Endereço não encontrado.');
            }
        }
    };

    const handleSetDestination = async (e) => {
        if (e.key === 'Enter') {
            setIsSearchingAddress(true);
            const result = await hereGeocodingService.geocode(destAddress, userPos);
            setIsSearchingAddress(false);

            if (result) {
                setDestPos([result.lat, result.lng]);
                setDestAddress(result.address);
                setStep('delivery_details');
                addMarker({ lat: result.lat, lng: result.lng }, 'destination');
                addMarker(userPos, 'origin');

                if (selectedCategory === 'ride') {
                    calculateRouteAndPrice(userPos, { lat: result.lat, lng: result.lng });
                }
            } else {
                toast.error('Endereço não encontrado.');
            }
        }
    };

    const calculateRouteAndPrice = async (origin, destination) => {
        setStep('estimating');
        const route = await hereRoutingService.getRoute(origin, destination);

        if (route) {
            const fare = calculateFare(parseFloat(route.distanceKm), route.durationMin, selectedService);
            setRideInfo({
                distance: parseFloat(route.distanceKm),
                duration: route.durationMin,
                price: Math.round(fare)
            });
            drawRoute(route.geometry);
        } else {
            toast.error('Erro ao calcular rota.');
            setStep('destination_input');
        }
    };

    const fetchServices = async () => {
        try {
            const response = await fetch(`${API_URL}/services`)
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





    const handleRequestRide = async () => {
        if (isRequestingTrip) return
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

        // 1. Try via Socket first
        if (socketRef.current?.connected) {
            console.log('🚀 Requesting trip via Socket')
            socketRef.current.emit('request_trip', tripPayload)
            setStep('searching')
        }
        // 2. Fallback to HTTP if socket disconnected
        else {
            console.log('📡 Socket disconnected, requesting trip via HTTP fallback')
            try {
                const response = await fetch(`${API_URL}/trips`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...tripPayload, userId: user.id })
                })

                if (response.ok) {
                    const data = await response.json()
                    setTripData({ tripId: data.id })
                    setStep('searching')
                    toast.success('Procurando motoristas...')
                } else {
                    toast.error('Erro ao solicitar viagem via API')
                }
            } catch (error) {
                console.error('HTTP Trip Request Error:', error)
                toast.error('Falha na conexão com o servidor')
            }
        }

        setTimeout(() => setIsRequestingTrip(false), 2000)
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
        if (markersRef.current.driver) {
            mapInstance.current.removeObject(markersRef.current.driver);
            markersRef.current.driver = null;
        }
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
                            <span className="live-value">Kz {Number(rideInfo.price).toLocaleString()}</span>
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
                    {/* HIDE MAP DURING ACTIVE RIDE TO REDUCE API CALLS & FOCUS ON DATA */}
                    {!['ongoing', 'finished', 'paid'].includes(step) ? (
                        <HereMap
                            center={userPos}
                            zoom={15}
                            onMapReady={(map, platform, ui) => {
                                mapInstance.current = map;
                                platformRef.current = platform;
                                uiRef.current = ui;
                                console.log('✅ HERE Map Ready');
                            }}
                        />
                    ) : (
                        <div className="trip-details-page animate-fade-in">
                            <div className="trip-status-header">
                                <div className="status-pill-premium">
                                    {step === 'ongoing' ? 'EM VIAGEM' : 'CHEGOU AO DESTINO'}
                                </div>
                                <div className="live-fare-display">
                                    <span className="kzs">Kz</span>
                                    <span className="amount">{Number(rideInfo.price).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="driver-profile-premium">
                                <div className="driver-avatar-large">
                                    {acceptedDriver?.name?.[0] || 'T'}
                                </div>
                                <h3>{acceptedDriver?.name}</h3>
                                <div className="driver-rating">★ 4.9 • Motorista Verificado</div>
                            </div>

                            <div className="trip-stats-grid">
                                <div className="trip-stat">
                                    <Clock size={20} />
                                    <span>{rideInfo.duration} min</span>
                                </div>
                                <div className="trip-stat">
                                    <Navigation size={20} />
                                    <span>{rideInfo.distance} km</span>
                                </div>
                                <div className="trip-stat">
                                    <CreditCard size={20} />
                                    <span>Dinheiro</span>
                                </div>
                            </div>

                            <div className="route-summary-box">
                                <div className="route-item">
                                    <div className="route-dot start"></div>
                                    <p>{originAddress}</p>
                                </div>
                                <div className="route-line-v"></div>
                                <div className="route-item">
                                    <div className="route-dot end"></div>
                                    <p>{destAddress}</p>
                                </div>
                            </div>

                            {selectedCategory === 'delivery' && (
                                <div className="delivery-info-summary">
                                    <h4>ENTREGA EM CURSO</h4>
                                    <p><strong>Para:</strong> {deliveryInfo.recipientName}</p>
                                    <p><strong>Item:</strong> {deliveryInfo.packageDescription}</p>
                                </div>
                            )}

                            <div className="trip-actions-footer">
                                <button className="btn-help"><HelpCircle size={20} /> Suporte</button>
                                <button className="btn-share"><Gift size={20} /> Dividir</button>
                            </div>
                        </div>
                    )}

                    <div className="map-overlay-top">
                        <div className="address-card shadow">
                            <div className={`address-row ${step === 'destination_input' ? 'collapsed' : ''}`} style={{ position: 'relative', zIndex: 1002 }}>
                                <span className="dot origin"></span>
                                <input
                                    type="text"
                                    value={originAddress}
                                    onChange={(e) => setOriginAddress(e.target.value)}
                                    placeholder="Onde você está?"
                                    onFocus={() => {
                                        setActiveField('origin');
                                        if (step === 'destination_input') setStep('service_selection'); // Volta para seleção se clicar na origem
                                    }}
                                    onKeyDown={(e) => handleAddressSubmit(e, 'origin')}
                                />
                                {activeField === 'origin' && addressSuggestions.length > 0 && (
                                    <ul className="suggestions-list animate-slide-up">
                                        {addressSuggestions.map(place => (
                                            <li key={place.id} onClick={() => handleSelectSuggestion(place)} className="suggestion-item">
                                                <div className="suggestion-icon"><MapPin size={16} /></div>
                                                <div className="suggestion-text">
                                                    <strong>{place.title}</strong>
                                                    <small>{place.address}</small>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Só mostra o Destino se tiver selecionado um serviço (step destination_input) */}
                            {step === 'destination_input' && (
                                <div className="address-row border-top" style={{ position: 'relative', zIndex: 1001 }}>
                                    <span className="dot destination"></span>
                                    <input
                                        type="text"
                                        placeholder="Para onde vamos?"
                                        value={destAddress}
                                        onChange={(e) => setDestAddress(e.target.value)}
                                        onFocus={() => setActiveField('destination')}
                                        onKeyDown={(e) => handleAddressSubmit(e, 'destination')}
                                        autoFocus
                                    />
                                    {activeField === 'destination' && addressSuggestions.length > 0 && (
                                        <ul className="suggestions-list animate-slide-up">
                                            {addressSuggestions.map(place => (
                                                <li key={place.id} onClick={() => handleSelectSuggestion(place)} className="suggestion-item">
                                                    <div className="suggestion-icon"><MapPin size={16} /></div>
                                                    <div className="suggestion-text">
                                                        <strong>{place.title}</strong>
                                                        <small>{place.address}</small>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {step !== 'destination_input' && destAddress && (
                                <div className="address-row border-top">
                                    <span className="dot destination"></span>
                                    <input type="text" value={destAddress} readOnly />
                                </div>
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
                                    <span className="val">Kz {Number(rideInfo.price).toLocaleString()}</span>
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
                                    <div className="summary-row"><span>Total Pago</span><strong>Kz {Number(receipt.total).toLocaleString()}</strong></div>
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
                                <div className="service-card shadow-lg pink" onClick={() => {
                                    if (!originAddress || originAddress === 'Localização atual') { toast.error('Confirme sua localização de origem no mapa.'); return; }
                                    setSelectedCategory('ride');
                                    setStep('sub_service_selection');
                                }}>
                                    <div className="icon">🏎️</div>
                                    <h3>Corrida</h3>
                                    <p>Para você viajar</p>
                                </div>
                                <div className="service-card shadow-lg white" onClick={() => {
                                    if (!originAddress || originAddress === 'Localização atual') { toast.error('Confirme sua localização de origem no mapa.'); return; }
                                    setSelectedCategory('delivery');
                                    setStep('sub_service_selection');
                                }}>
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
