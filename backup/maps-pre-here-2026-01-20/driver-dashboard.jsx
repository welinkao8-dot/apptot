import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Menu, User, DollarSign, Navigation, Clock, Power, CheckCircle, ChevronRight, MapPin, Home, History, LogOut, Play, Square, CreditCard, Phone, MessageSquare } from 'lucide-react'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { io } from 'socket.io-client'
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

const SOCKET_URL = 'http://localhost:3004'

export default function Dashboard() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const [isOnline, setIsOnline] = useState(false)
    const [stats, setStats] = useState({ rides: 0, earnings: 0 })
    const [requests, setRequests] = useState([])
    const [activeRide, setActiveRide] = useState(null)
    const [rideStatus, setRideStatus] = useState('idle') // idle, accepted, ongoing, finished, paid
    const [fare, setFare] = useState(0)
    const socketRef = useRef(null)
    const fareInterval = useRef(null)

    const mapRef = useRef(null)
    const mapInstance = useRef(null)
    const driverMarker = useRef(null)

    // Armazena última posição conhecida para enviar junto com o taxímetro
    const latestCoords = useRef({ lat: -8.84, lng: 13.29 })

    const fetchStats = async () => {
        try {
            if (!user) return
            const res = await axios.get(`${SOCKET_URL}/trips/stats/${user.id}`)
            if (res.data) {
                setStats(res.data)
            }
        } catch (error) {
            console.error('Error fetching stats:', error)
        }
    }

    // GERENCIAMENTO DE GPS EM TEMPO REAL
    useEffect(() => {
        let watchId = null

        if (isOnline && socketRef.current) {
            if ('geolocation' in navigator) {
                console.log('📡 Iniciando GPS Tracker...')
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords
                        latestCoords.current = { lat: latitude, lng: longitude }

                        // Atualizar marcador no mapa local se visualmente necessário
                        if (driverMarker.current) {
                            driverMarker.current.setLatLng([latitude, longitude])
                        }

                        // Enviar coordenadas para o servidor (Persistência & Clientes)
                        // IMPORTANTE: Envia activeClientId para que o Gateway faça o roteamento correto via socket.to()
                        const payload = {
                            driverId: user.id || user.driver_id, // Fallback safety
                            lat: latitude,
                            lng: longitude,
                            activeClientId: activeRide ? activeRide.clientId : null
                        }
                        socketRef.current.emit('update_location', payload)

                        // Debug visual (console) apenas em dev
                        // console.log('📍 GPS Update:', latitude, longitude)
                    },
                    (error) => {
                        console.error('Erro de GPS:', error)
                        // Não mostre toast a cada erro para não spammar, mas logue
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 5000
                    }
                )
            } else {
                toast.error('GPS não suportado neste navegador.')
            }
        }

        return () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId)
                console.log('🛑 GPS Parado.')
            }
        }
    }, [isOnline, activeRide, user])

    // GERENCIAMENTO DE MAPA EM TEMPO REAL
    useEffect(() => {
        const initMap = () => {
            if (activeRide && mapRef.current && !mapInstance.current) {
                mapInstance.current = L.map(mapRef.current, {
                    center: [latestCoords.current.lat, latestCoords.current.lng],
                    zoom: 16,
                    zoomControl: false,
                    attributionControl: false
                })
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current)

                driverMarker.current = L.marker([latestCoords.current.lat, latestCoords.current.lng], {
                    icon: L.divIcon({
                        html: '<div class="driver-marker-pulse-mini">🚕</div>',
                        className: 'custom-div-icon'
                    })
                }).addTo(mapInstance.current)

                // Forçar recálculo de tamanho para telas mobile
                setTimeout(() => {
                    if (mapInstance.current) mapInstance.current.invalidateSize()
                }, 400)
            }
        }

        const timer = setTimeout(initMap, 300)

        return () => {
            clearTimeout(timer)
            if (mapInstance.current) {
                mapInstance.current.remove()
                mapInstance.current = null
            }
        }
    }, [activeRide])

    // GERENCIAMENTO DE SOCKET (ESTABILIZADO)
    useEffect(() => {
        if (user) {
            fetchStats() // Fetch on mount
            socketRef.current = io(SOCKET_URL)

            socketRef.current.on('connect', () => {
                console.log('Socket Connected, joining room...')
                socketRef.current.emit('join', { userId: user.id, role: 'driver' })
            })

            socketRef.current.on('login_status', (status) => {
                console.log('Login status from server:', status)
                setIsOnline(status.isOnline)
            })

            socketRef.current.on('new_trip_available', (trip) => {
                // SÓ mostra novas corridas se o estado local for IDLE e estiver online
                // (O backend já filtra por online, mas mantemos segurança no front)
                setRequests(prev => {
                    if (prev.find(r => r.id === trip.id)) return prev
                    return [trip, ...prev]
                })
                toast.success('NOVA CORRIDA!', { icon: '🏎️', style: { background: '#E91E63', color: '#fff' } })
            })

            socketRef.current.on('pending_trips', (trips) => {
                console.log('Received pending trips:', trips)
                // NO auto-online here. Trust the login_status and toggle_online events.
                setRequests(trips)
            })

            socketRef.current.on('trip_taken', (data) => {
                setRequests(prev => prev.filter(req => req.id !== data.tripId))
            })

            socketRef.current.on('restore_ride', (trip) => {
                console.log('Restoring ride from DB:', trip)
                setActiveRide(trip)
                setRideStatus(trip.status === 'accepted' ? 'accepted' : 'ongoing')
                if (trip.status === 'ongoing') {
                    setFare(parseFloat(trip.current_fare) || 0)
                }
            })

            socketRef.current.on('trip_cancelled', (data) => {
                toast.error('Corrida cancelada pelo cliente.', { duration: 5000 })
                setActiveRide(null)
                setRideStatus('idle')
                setFare(0)
            })

            socketRef.current.on('trip_cancelled_global', (data) => {
                setRequests(prev => prev.filter(req => req.id !== data.tripId))
            })

            // CRITICAL: Listen for account suspension in real-time
            socketRef.current.on('account_suspended', (data) => {
                console.log('⛔ Account suspended:', data)
                toast.error(data.message || 'Sua conta foi suspensa pelo administrador', { duration: 5000 })
                // Force logout and update user status
                const updatedUser = { ...user, status: 'suspended' }
                localStorage.setItem('tot_driver_user', JSON.stringify(updatedUser))
                // Reload to trigger App.jsx routing to /suspended
                setTimeout(() => window.location.reload(), 2000)
            })

            // Listen for account activation
            socketRef.current.on('account_activated', (data) => {
                console.log('✅ Account activated:', data)
                toast.success(data.message || 'Sua conta foi reativada!', { duration: 5000 })
                const updatedUser = { ...user, status: 'active' }
                localStorage.setItem('tot_driver_user', JSON.stringify(updatedUser))
            })

            const heartbeatInterval = setInterval(() => {
                if (socketRef.current?.connected) {
                    socketRef.current.emit('ping')
                }
            }, 30000)

            return () => {
                if (socketRef.current) socketRef.current.disconnect()
                clearInterval(heartbeatInterval)
            }
        }
    }, [user]) // rideStatus REMOVED to keep socket connected

    const handleToggleStatus = () => {
        if (activeRide) {
            toast.error('Finalize a corrida atual primeiro!')
            return
        }

        const newStatus = !isOnline
        setIsOnline(newStatus)

        if (newStatus) {
            toast.success('Você está ONLINE!', { style: { background: '#E91E63', color: '#fff' } })
        } else {
            setRequests([])
            toast('Você está OFFLINE', { icon: '💤' })
        }

        if (socketRef.current) {
            socketRef.current.emit('toggle_online', { userId: user.id, isOnline: newStatus })
        }
    }

    const handleAcceptRide = (req) => {
        if (socketRef.current) {
            socketRef.current.emit('accept_trip', {
                tripId: req.id,
                driverId: user.id,
                clientId: req.clientId,
                driverName: user.full_name
            }, (response) => {
                if (response?.success) {
                    setActiveRide(req)
                    setRideStatus('accepted')
                    setRequests([])
                    setFare(parseFloat(req.price) || 1500)
                    toast.success('Corrida aceita! Dirija-se ao cliente.')
                } else {
                    toast.error(response?.error || 'Erro ao aceitar corrida')
                }
            })
        }
    }

    const handleStartRide = () => {
        if (socketRef.current && activeRide) {
            socketRef.current.emit('start_ride', { tripId: activeRide.id, clientId: activeRide.clientId })
            setRideStatus('ongoing')
            toast.success('Corrida Iniciada!')

            // Inicia Taxímetro Simulado
            fareInterval.current = setInterval(() => {
                setFare(prev => {
                    const newFare = prev + 50
                    socketRef.current.emit('trip_progress', {
                        tripId: activeRide.id,
                        clientId: activeRide.clientId,
                        currentFare: newFare,
                        coords: latestCoords.current // Usa GPS real capturado pelo watcher
                    })
                    return newFare
                })
            }, 5000)
        }
    }

    const handleCancelRide = () => {
        if (socketRef.current && activeRide) {
            socketRef.current.emit('cancel_trip', {
                tripId: activeRide.id,
                userId: user.id,
                role: 'driver'
            })
            setActiveRide(null)
            setRideStatus('idle')
            setFare(0)
            toast('Corrida cancelada.', { icon: '🚫' })
        }
    }

    const handleFinishRide = () => {
        if (fareInterval.current) clearInterval(fareInterval.current)
        if (socketRef.current && activeRide) {
            socketRef.current.emit('finish_ride', {
                tripId: activeRide.id,
                clientId: activeRide.clientId,
                finalFare: fare.toString()
            })
            setRideStatus('finished')
            toast.success('Viagem Concluída! Aguardando Pagamento.')
        }
    }

    const handleConfirmPayment = () => {
        if (socketRef.current && activeRide) {
            const receipt = {
                id: activeRide.id,
                driver: user.full_name,
                total: fare,
                date: new Date().toLocaleString(),
                from: activeRide.pickupAddress,
                to: activeRide.destAddress
            }
            socketRef.current.emit('confirm_payment', {
                tripId: activeRide.id,
                clientId: activeRide.clientId,
                receiptData: receipt
            })
            setRideStatus('paid')
            toast.success('Pagamento Confirmado! Recibo Gerado.')
            fetchStats() // Update stats after payment
        }
    }

    const resetToIdle = () => {
        setActiveRide(null)
        setRideStatus('idle')
        setFare(0)
    }

    // TELA DE CORRIDA ATIVA
    if (activeRide && (['accepted', 'ongoing', 'finished', 'paid'].includes(rideStatus))) {
        return (
            <div className="driver-dashboard-mobile ride-active-screen">
                <header className="ride-header-premium">
                    <div className="ride-status-badge">
                        {rideStatus === 'accepted' && 'A CAMINHO DO CLIENTE'}
                        {rideStatus === 'ongoing' && 'VIAGEM EM CURSO'}
                        {rideStatus === 'finished' && 'AGUARDANDO PAGAMENTO'}
                        {rideStatus === 'paid' && 'CORRIDA CONCLUÍDA'}
                    </div>
                    <div className="fare-display">
                        <span className="fare-label">Kz</span>
                        <span className="fare-value">{fare.toLocaleString()}</span>
                    </div>
                </header>

                <main className="ride-map-container">
                    <div className="mock-map">
                        <div id="driver-map" ref={mapRef}></div>
                        <div className="map-placeholder">
                            <Navigation size={48} color="#E91E63" className="moving-car" />
                            <p>Monitorando Trajeto...</p>
                        </div>
                    </div>

                    <div className="ride-info-card shadow-lg">
                        <div className="client-header">
                            <div className="client-avatar">{activeRide.userName?.[0] || 'U'}</div>
                            <div className="client-details">
                                <strong>{activeRide.userName}</strong>
                                <span>Cliente TOT Premium</span>
                            </div>
                            <div className="header-actions-end">
                                <button className="btn-call-client"><Phone size={18} /></button>
                                <button className="btn-call-client"><MessageSquare size={18} /></button>
                            </div>
                        </div>

                        {activeRide.category === 'delivery' && activeRide.deliveryInfo && (
                            <div className="delivery-detail-box animate-fade-in">
                                <h4>DETALHES DA ENTREGA</h4>
                                <div className="delivery-item">
                                    <div className="icon-wrap"><User size={16} /></div>
                                    <div className="delivery-item-text">
                                        <span className="label">Destinatário</span>
                                        <span className="val">{activeRide.deliveryInfo.recipientName}</span>
                                    </div>
                                </div>
                                <div className="delivery-item">
                                    <div className="icon-wrap"><Phone size={16} /></div>
                                    <div className="delivery-item-text">
                                        <span className="label">Telefone</span>
                                        <span className="val">{activeRide.deliveryInfo.recipientPhone}</span>
                                    </div>
                                </div>
                                <div className="delivery-desc">
                                    {activeRide.deliveryInfo.packageDescription || 'Sem descrição do pacote'}
                                </div>
                                {activeRide.deliveryInfo.instructions && (
                                    <div className="delivery-desc" style={{ marginTop: '5px', borderLeft: '3px solid #E91E63' }}>
                                        <strong>Obs:</strong> {activeRide.deliveryInfo.instructions}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="destination-info">
                            <span className="dest-label">DESTINO DA CORRIDA</span>
                            <div className="info-row">
                                <MapPin size={18} color="#E91E63" />
                                <span>{activeRide.destAddress}</span>
                            </div>
                        </div>

                        {rideStatus === 'accepted' && (
                            <div className="flex flex-col gap-2 w-full">
                                <button className="btn-ride-control start" onClick={handleStartRide}>
                                    <Play size={20} /> INICIAR CORRIDA
                                </button>
                                <button className="btn-ride-control cancel-mini" onClick={handleCancelRide} style={{ background: '#fef2f2', color: '#ef4444', height: '40px', fontSize: '14px' }}>
                                    CANCELAR CORRIDA
                                </button>
                            </div>
                        )}
                        {rideStatus === 'ongoing' && (
                            <button className="btn-ride-control finish" onClick={handleFinishRide}>
                                <Square size={20} /> FINALIZAR CORRIDA
                            </button>
                        )}
                        {rideStatus === 'finished' && (
                            <button className="btn-ride-control payment" onClick={handleConfirmPayment}>
                                <CreditCard size={20} /> CONFIRMAR PAGAMENTO
                            </button>
                        )}
                        {rideStatus === 'paid' && (
                            <div className="concluded-actions">
                                <button className="btn-receipt-view" onClick={() => navigate('/history')}>VER RECIBO</button>
                                <button className="btn-back-home" onClick={resetToIdle}>VOLTAR AO INÍCIO</button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="driver-dashboard-mobile">
            <header className="dash-header-premium">
                <div className="header-top">
                    <button className="icon-btn shadow-sm"><Menu size={24} /></button>
                    <h1 className="logo-text-small">TOT</h1>
                    <div className="profile-mini shadow-sm"><User size={20} /></div>
                </div>
                <div className="status-selector-container">
                    <div className={`status-pill-big ${isOnline ? 'online' : 'offline'}`}>
                        <span className="status-text">{isOnline ? 'VOCÊ ESTÁ ONLINE' : 'VOCÊ ESTÁ OFFLINE'}</span>
                        <button className={`toggle-switch ${isOnline ? 'active' : ''}`} onClick={handleToggleStatus}>
                            <Power size={22} color={isOnline ? '#fff' : '#94a3b8'} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="dash-body">
                <section className="welcome-banner">
                    <h2>Olá, {user?.full_name?.split(' ')[0] || 'Motorista'}! 👋</h2>
                    <p>Veja seus resultados de hoje</p>
                </section>

                <section className="stats-grid-premium">
                    <div className="stat-card-gradient pink-grad shadow-lg">
                        <div className="stat-icon-bg"><Navigation size={22} color="#fff" /></div>
                        <div className="stat-content">
                            <span className="stat-label">Corridas Hoje</span>
                            <span className="stat-value">{stats.rides}</span>
                        </div>
                    </div>
                    <div className="stat-card-gradient purple-grad shadow-lg">
                        <div className="stat-icon-bg"><DollarSign size={22} color="#fff" /></div>
                        <div className="stat-content">
                            <span className="stat-label">Total Faturado</span>
                            <span className="stat-value">Kz {stats.earnings.toLocaleString()}</span>
                        </div>
                    </div>
                </section>

                <section className="requests-section">
                    <div className="section-header">
                        <h3>Solicitações Próximas</h3>
                        <span className="badge-pulse">{requests.length}</span>
                    </div>

                    <div className="requests-list">
                        {isOnline ? (
                            requests.length > 0 ? (
                                requests.map(req => (
                                    <div key={req.id} className="request-card shadow-sm animate-fade-in">
                                        <div className="req-header">
                                            <div className="user-info-mini">
                                                <div className="avatar-letter">{req.userName ? req.userName[0] : 'U'}</div>
                                                <div className="flex flex-col">
                                                    <strong>{req.userName}</strong>
                                                    <span className={`category-badge ${req.category || 'ride'}`}>
                                                        {req.category === 'delivery' ? 'Entrega' : 'Corrida'}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="req-price">Kz {req.price?.toLocaleString()}</span>
                                        </div>
                                        <div className="req-path">
                                            <div className="path-item">
                                                <MapPin size={16} color="#E91E63" />
                                                <span>{req.pickupAddress}</span>
                                            </div>
                                            <div className="path-line"></div>
                                            <div className="path-item">
                                                <Navigation size={16} color="#1e293b" />
                                                <span>{req.destAddress}</span>
                                            </div>
                                        </div>
                                        <div className="req-footer">
                                            <button className="btn-accept-mini" onClick={() => handleAcceptRide(req)}>ACEITAR</button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="waiting-state">
                                    <div className="radar-ping-mini"></div>
                                    <p>Aguardando novas chamadas...</p>
                                </div>
                            )
                        ) : (
                            <div className="offline-state">
                                <Power size={48} color="#cbd5e1" />
                                <p>Fique online para ver as solicitações de hoje.</p>
                                <button className="btn-go-online" onClick={handleToggleStatus}>ATIVAR TURNO</button>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <footer className="bottom-nav shadow-lg">
                <button className="nav-tab active"><Home size={22} /><span>Início</span></button>
                <Link to="/history" className="nav-tab"><DollarSign size={22} /><span>Ganhos</span></Link>
                <Link to="/history" className="nav-tab"><History size={22} /><span>Viagens</span></Link>
                <button className="nav-tab" onClick={signOut}><LogOut size={22} /><span>Sair</span></button>
            </footer>
        </div>
    )
}
