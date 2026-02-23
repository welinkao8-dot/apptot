import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Menu, User, DollarSign, Navigation, Clock, Power, CheckCircle, ChevronRight, MapPin, Home, History, LogOut, Play, Square, CreditCard, Phone, MessageSquare, Maximize2, Minimize2, ArrowUp, ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, RotateCcw, Crosshair } from 'lucide-react'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import HereMap from '../components/HereMap'
import { hereRoutingService } from '../services/hereRoutingService'
import './Dashboard.css'

// Helper para ícones de manobra
const getManeuverIcon = (action) => {
    switch (action) {
        case 'turn-left': return <CornerUpLeft size={32} color="white" />;
        case 'turn-right': return <CornerUpRight size={32} color="white" />;
        case 'uturn-left':
        case 'uturn-right': return <RotateCcw size={32} color="white" />;
        case 'sharp-left': return <ArrowLeft size={32} color="white" />;
        case 'sharp-right': return <ArrowRight size={32} color="white" />;
        default: return <ArrowUp size={32} color="white" />;
    }
}

const translateInstruction = (instruction) => {
    if (!instruction) return ''
    return instruction
        .replace(/Go for /gi, '')
        .replace(/Head/gi, 'Siga')
        .replace(/Turn left/gi, 'Vire à esquerda')
        .replace(/Turn right/gi, 'Vire à direita')
        .replace(/Keep left/gi, 'Mantenha-se à esquerda')
        .replace(/Keep right/gi, 'Mantenha-se à direita')
        .replace(/Take the exit/gi, 'Pegue a saída')
        .replace(/Arrive at/gi, 'Chegando em')
        .replace(/onto/gi, 'na')
        .replace(/towards/gi, 'em direção a')
        .replace(/street/gi, 'Rua')
        .replace(/avenue/gi, 'Avenida')
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL.replace('/auth', '')

export default function Dashboard() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const [isOnline, setIsOnline] = useState(false)
    const [stats, setStats] = useState({ rides: 0, earnings: 0 })
    const [requests, setRequests] = useState([])

    // STATE MANAGEMENT
    const [activeRide, setActiveRide] = useState(() => {
        try {
            const saved = localStorage.getItem('tot_active_ride')
            return saved ? JSON.parse(saved).ride : null
        } catch (e) { return null }
    })
    const [rideStatus, setRideStatus] = useState(() => {
        try {
            const saved = localStorage.getItem('tot_active_ride')
            return saved ? JSON.parse(saved).status : 'idle'
        } catch (e) { return 'idle' }
    })

    const [fare, setFare] = useState(0)
    const [isModalMinimized, setIsModalMinimized] = useState(false)
    const [navigationInstructions, setNavigationInstructions] = useState([])
    const [currentManeuver, setCurrentManeuver] = useState(null)
    const [rideStats, setRideStats] = useState({ distance: '...', time: '...' })
    const [forceRouteUpdate, setForceRouteUpdate] = useState(0)
    const [isFollowing, setIsFollowing] = useState(true)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isGpsLost, setIsGpsLost] = useState(false)

    // REFS
    const socketRef = useRef(null)
    const fareInterval = useRef(null)
    const currentRouteRef = useRef(null)
    const isRecalculating = useRef(false)
    const lastProgressIndex = useRef(0)
    const lastBearing = useRef(0)

    // MAP OBJECT REFS
    const mapInstance = useRef(null)
    const driverMarker = useRef(null)
    const completedPolylineRef = useRef(null)
    const remainingPolylineRef = useRef(null)
    const mainPolylineRef = useRef(null)
    const lastGpsUpdate = useRef(0) // [NEW] For adaptive smoothing

    const latestCoords = useRef({ lat: -8.84, lng: 13.29 })
    const lastMarkerPos = useRef(null)
    const animationFrameRef = useRef(null)

    // Computed visibility
    const isRideActive = activeRide && ['accepted', 'ongoing', 'finished', 'paid'].includes(rideStatus)

    // CLEANUP FUNCTION
    const clearMapObjects = () => {
        if (!mapInstance.current || !window.H) return
        try {
            if (completedPolylineRef.current) mapInstance.current.removeObject(completedPolylineRef.current)
            if (remainingPolylineRef.current) mapInstance.current.removeObject(remainingPolylineRef.current)
            if (mainPolylineRef.current) mapInstance.current.removeObject(mainPolylineRef.current)

            completedPolylineRef.current = null
            remainingPolylineRef.current = null
            mainPolylineRef.current = null
            currentRouteRef.current = null

            mapInstance.current.getObjects().forEach(obj => {
                if (obj.getData?.() === 'route-marker') mapInstance.current.removeObject(obj)
            })
        } catch (e) { console.error('Cleanup error:', e) }
    }

    const resetToIdle = () => {
        localStorage.removeItem('tot_route_cache')
        clearMapObjects()
        setActiveRide(null)
        setRideStatus('idle')
        setFare(0)
        setNavigationInstructions([])
        setCurrentManeuver(null)
        if (fareInterval.current) clearInterval(fareInterval.current)
    }

    const fetchStats = async () => {
        try {
            if (!user) return
            const res = await axios.get(`${API_URL}/trips/stats/${user.id}`)
            if (res.data) setStats(res.data)
        } catch (error) { console.error('Error fetching stats:', error) }
    }

    const fetchPendingTrips = async (currentStatus = isOnline) => {
        if (!currentStatus) return
        try {
            const res = await axios.get(`${API_URL}/trips/pending`)
            if (res.data) setRequests(res.data)
        } catch (error) { console.error('Fetch error:', error) }
    }

    // GPS WATCHER
    useEffect(() => {
        let watchId = null
        if (isOnline && socketRef.current) {
            if ('geolocation' in navigator) {
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords
                        latestCoords.current = { lat: latitude, lng: longitude }

                        // [PREMIUM] Track GPS updates for loss detection
                        lastGpsUpdate.current = Date.now()
                        if (isGpsLost) setIsGpsLost(false)

                        updateDriverMarker(latitude, longitude)

                        if (isRideActive && currentRouteRef.current) {
                            try {
                                checkRouteDeviation(latitude, longitude)
                                const progress = calculateRouteProgress(currentRouteRef.current, { lat: latitude, lng: longitude })
                                if (progress && progress.index > lastProgressIndex.current + 2) {
                                    updateProgressiveRoute(progress)
                                    lastProgressIndex.current = progress.index

                                    // [PREMIUM] Update Maneuver Countdown
                                    updateManeuverProgress(latitude, longitude, progress.index)
                                }
                            } catch (e) { console.error('GPS Logic error:', e) }
                        }

                        socketRef.current.emit('update_location', {
                            driverId: user?.id || user?.driver_id,
                            lat: latitude,
                            lng: longitude,
                            activeClientId: activeRide?.clientId || null
                        })
                    },
                    (err) => console.error('GPS error:', err),
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } // [PREMIUM] Real-time settings
                )
            }
        }
        return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId) }
    }, [isOnline, isRideActive, activeRide, user])

    // STATE PERSISTENCE
    useEffect(() => {
        if (activeRide) {
            localStorage.setItem('tot_active_ride', JSON.stringify({ ride: activeRide, status: rideStatus }))
        } else {
            localStorage.removeItem('tot_active_ride')
        }
    }, [activeRide, rideStatus])

    // [PREMIUM] GPS SIGNAL LOSS DETECTOR
    useEffect(() => {
        if (!isRideActive) return

        const GPS_TIMEOUT = 15000 // 15 segundos sem sinal = perda
        const checkInterval = setInterval(() => {
            const timeSinceLastGps = Date.now() - lastGpsUpdate.current
            if (timeSinceLastGps > GPS_TIMEOUT && !isGpsLost) {
                setIsGpsLost(true)
                toast.error('⚠️ Sinal GPS perdido', { duration: 5000 })
            }
        }, 5000) // Verificar a cada 5 segundos

        return () => clearInterval(checkInterval)
    }, [isRideActive, isGpsLost])

    // CACHE LOADER & ROUTE EXECUTION
    useEffect(() => {
        const calculateAndDrawRoute = async () => {
            if (!isRideActive || !mapInstance.current || !window.H) return

            // 1. TRY CACHE FIRST
            const cached = localStorage.getItem('tot_route_cache')
            if (cached) {
                try {
                    const cacheData = JSON.parse(cached)
                    if (cacheData.rideId === activeRide.id && cacheData.status === rideStatus) {
                        console.log('⚡ Using cached route data')
                        renderRouteData(cacheData.routeData)
                        return // Skip API
                    }
                } catch (e) { localStorage.removeItem('tot_route_cache') }
            }

            // 2. API FALLBACK
            let start = latestCoords.current
            let end = null
            if (rideStatus === 'accepted') end = activeRide?.coords || { lat: activeRide?.pickupLat, lng: activeRide?.pickupLng }
            else if (rideStatus === 'ongoing') end = activeRide?.destPos || { lat: activeRide?.destLat, lng: activeRide?.destLng }

            if (start && end && typeof end.lat === 'number') {
                // [PREMIUM] Vehicle-Specific Routing
                // Map vehicle category to HERE transport modes
                const vehicleCategory = activeRide?.service?.category || 'car'
                let transportMode = 'car' // default
                if (vehicleCategory.toLowerCase().includes('moto') || vehicleCategory.toLowerCase().includes('scooter')) {
                    transportMode = 'scooter'
                }
                console.log(`🏍️ Using transport mode: ${transportMode} (from category: ${vehicleCategory})`)

                const routeData = await hereRoutingService.getRoute(start, end, transportMode)
                if (routeData && routeData.geometry) {
                    renderRouteData(routeData)
                    // SAVE TO CACHE
                    localStorage.setItem('tot_route_cache', JSON.stringify({
                        rideId: activeRide.id,
                        status: rideStatus,
                        routeData
                    }))
                }
            }
        }

        const renderRouteData = (routeData) => {
            if (!mapInstance.current || !window.H) return
            clearMapObjects()
            currentRouteRef.current = routeData.geometry
            lastProgressIndex.current = 0

            if (routeData.actions) {
                setNavigationInstructions(routeData.actions)
                setCurrentManeuver(routeData.actions.find(a => a.action !== 'depart') || routeData.actions[0])
            }
            setRideStats({
                distance: routeData.distanceKm + ' km',
                time: routeData.durationMin + ' min'
            })

            if (isFollowing) {
                const lineString = new window.H.geo.LineString()
                routeData.geometry.forEach(p => lineString.pushPoint({ lat: p[0], lng: p[1] }))
                mapInstance.current.getViewModel().setLookAtData({
                    bounds: lineString.getBoundingBox(),
                    padding: { top: 140, bottom: 300, left: 60, right: 60 }
                })
            }

            const endCoord = currentRouteRef.current[currentRouteRef.current.length - 1]
            const endIcon = new window.H.map.DomIcon(`
                <div style="width: 32px; height: 32px; position: relative;">
                    <div style="position: absolute; top: -16px; left: -16px; background: ${rideStatus === 'accepted' ? '#00afea' : '#E91E63'}; width: 32px; height: 32px; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4);"></div>
                </div>
            `)
            const endMarker = new window.H.map.DomMarker({ lat: endCoord[0], lng: endCoord[1] }, { icon: endIcon })
            endMarker.setData('route-marker')
            mapInstance.current.addObject(endMarker)
            updateProgressiveRoute({ index: 0 })
        }

        calculateAndDrawRoute()
    }, [activeRide?.id, rideStatus, forceRouteUpdate])

    const checkRouteDeviation = (lat, lng) => {
        if (!currentRouteRef.current || isRecalculating.current) return
        let minDistance = Infinity
        for (let i = 0; i < currentRouteRef.current.length; i += 10) {
            const p = currentRouteRef.current[i]
            const dist = haversine(lat, lng, p[0], p[1])
            if (dist < minDistance) minDistance = dist
        }
        if (minDistance > 0.15) { // 150m
            isRecalculating.current = true
            toast('Recalculando rota...', { icon: '🔄' })
            localStorage.removeItem('tot_route_cache')
            setForceRouteUpdate(p => p + 1)
            setTimeout(() => { isRecalculating.current = false }, 2000)
        }
    }

    const haversine = (lat1, lon1, lat2, lon2) => {
        const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const calculateRouteProgress = (routeGeometry, currentPosition) => {
        if (!routeGeometry?.length) return null
        let minDistance = Infinity; let closestIndex = 0;

        // [PREMIUM] Otimização: Busca em janela ao redor do último índice conhecido
        // Em rotas longas (>100km), isso reduz o custo de O(n) para O(janela)
        const windowSize = 50 // Pontos à frente
        const backstep = 10   // Pontos atrás (caso de retorno)
        const startSearch = Math.max(0, lastProgressIndex.current - backstep)
        const endSearch = Math.min(routeGeometry.length, lastProgressIndex.current + windowSize)

        for (let i = startSearch; i < endSearch; i++) {
            const point = routeGeometry[i]
            const dist = haversine(currentPosition.lat, currentPosition.lng, point[0], point[1])
            if (dist < minDistance) { minDistance = dist; closestIndex = i; }
        }

        return { index: closestIndex }
    }

    // [PREMIUM] Real-Time Maneuver Updates
    const updateManeuverProgress = (lat, lng, currentIndex) => {
        if (!navigationInstructions.length) return

        // 1. Find the next relevant maneuver (offset > currentIndex)
        // HERE 'offset' is the index in the polyline
        const nextManeuver = navigationInstructions.find(m => m.offset > currentIndex)

        if (!nextManeuver) {
            setCurrentManeuver(null) // Arrived or end of route
            return
        }

        // 2. Calculate precise distance to that maneuver
        // Dist = (Driver -> CurrentIndexPoint) + (Sum of segments from CurrentIndex to ManeuverOffset)

        // A. Driver to snapped point on route (approximation)
        const pCurrent = currentRouteRef.current[currentIndex]
        if (!pCurrent) return
        let distToNext = haversine(lat, lng, pCurrent[0], pCurrent[1]) * 1000 // meters

        // B. Sum of remaining segments
        // We use a simplified calculation for performance: straight line between points
        for (let i = currentIndex; i < nextManeuver.offset && i < currentRouteRef.current.length - 1; i++) {
            const p1 = currentRouteRef.current[i]
            const p2 = currentRouteRef.current[i + 1]
            if (p1 && p2) {
                distToNext += haversine(p1[0], p1[1], p2[0], p2[1]) * 1000
            }
        }

        // 3. Update State with "Live" data
        setCurrentManeuver({
            ...nextManeuver,
            dynamicDistance: Math.round(distToNext),
            isTurnNow: distToNext < 30 // "TURN NOW" threshold
        })
    }

    const updateProgressiveRoute = (progress) => {
        if (!mapInstance.current || !currentRouteRef.current || !window.H) return
        const geometry = currentRouteRef.current
        const splitIndex = progress.index

        if (completedPolylineRef.current) mapInstance.current.removeObject(completedPolylineRef.current)
        if (remainingPolylineRef.current) mapInstance.current.removeObject(remainingPolylineRef.current)

        const currentCoord = geometry[splitIndex]
        if (currentCoord) createSparkle(currentCoord[0], currentCoord[1])

        // 1. TRAVELED PART (Solid Dark Blue)
        const completedPoints = geometry.slice(0, splitIndex + 1)
        if (completedPoints.length >= 2) {
            const lineStringC = new window.H.geo.LineString()
            completedPoints.forEach(p => lineStringC.pushPoint({ lat: p[0], lng: p[1] }))
            completedPolylineRef.current = new window.H.map.Polyline(lineStringC, {
                style: { strokeColor: '#003366', lineWidth: 7, lineCap: 'round', lineJoin: 'round' }
            })
            mapInstance.current.addObject(completedPolylineRef.current)
        }

        // 2. TARGET PART (Vibrant Pink)
        const remainingPoints = geometry.slice(splitIndex)
        if (remainingPoints.length >= 2) {
            const lineStringR = new window.H.geo.LineString()
            remainingPoints.forEach(p => lineStringR.pushPoint({ lat: p[0], lng: p[1] }))
            remainingPolylineRef.current = new window.H.map.Polyline(lineStringR, {
                style: { strokeColor: '#E91E63', lineWidth: 8, lineCap: 'round', lineJoin: 'round' }
            })
            mapInstance.current.addObject(remainingPolylineRef.current)
        }
    }

    const createSparkle = (lat, lng) => {
        if (!mapInstance.current) return
        const screenPos = mapInstance.current.geoToScreen({ lat, lng })
        if (!screenPos) return
        const sparkle = document.createElement('div')
        sparkle.className = 'route-sparkle'
        sparkle.style.left = `${screenPos.x}px`; sparkle.style.top = `${screenPos.y}px`
        document.body.appendChild(sparkle)
        setTimeout(() => { if (sparkle.parentNode) sparkle.parentNode.removeChild(sparkle) }, 1000)
    }

    // [PREMIUM] Geometric Snapping Helper
    const getClosestPointOnSegment = (p, a, b) => {
        const atob = { x: b.lng - a.lng, y: b.lat - a.lat }
        const atop = { x: p.lng - a.lng, y: p.lat - a.lat }
        const len = atob.x * atob.x + atob.y * atob.y
        let dot = atop.x * atob.x + atop.y * atob.y
        const t = Math.min(1, Math.max(0, dot / len))
        return {
            lat: a.lat + atob.y * t,
            lng: a.lng + atob.x * t
        }
    }

    const calculateBearing = (startLat, startLng, destLat, destLng) => {
        if (!startLat || !destLat) return 0
        const toRad = deg => deg * Math.PI / 180; const toDeg = rad => rad * 180 / Math.PI
        const y = Math.sin(toRad(destLng) - toRad(startLng)) * Math.cos(toRad(destLat))
        const x = Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) - Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(toRad(destLng) - toRad(startLng))
        return (toDeg(Math.atan2(y, x)) + 360) % 360
    }

    const updateDriverMarker = (rawLat, rawLng) => {
        if (!mapInstance.current || !window.H) return

        // 1. Calculate Adaptive Duration based on GPS frequency
        const now = performance.now()
        let duration = 1000 // default fallback
        if (lastGpsUpdate.current > 0) {
            duration = now - lastGpsUpdate.current
            // Clamp duration to avoid jumps if GPS signal was lost for too long
            if (duration > 3000) duration = 1000
        }
        lastGpsUpdate.current = now

        let targetLat = rawLat
        let targetLng = rawLng
        let targetBearing = lastBearing.current

        // 2. ROUTE SNAPPING LOGIC (The "Magnet")
        // Only snap if we have an active route and are close enough (< 25m)
        if (isRideActive && currentRouteRef.current && currentRouteRef.current.length > 1) {
            let minDist = Infinity
            let snappedPoint = null
            let bestSegmentHeading = null

            // Check segments near the last known progress index to save CPU
            // We search a window of +/- 10 points around last index or full route if undefined
            // For simplicity/safety in this iteration, we scan the whole route (optimize later for long trips)
            // But let's skip every 2nd point for speed
            const route = currentRouteRef.current
            for (let i = 0; i < route.length - 1; i++) {
                const p1 = { lat: route[i][0], lng: route[i][1] }
                const p2 = { lat: route[i + 1][0], lng: route[i + 1][1] }

                // Quick bounding box check could go here...

                const closest = getClosestPointOnSegment({ lat: rawLat, lng: rawLng }, p1, p2)
                const d = haversine(rawLat, rawLng, closest.lat, closest.lng) * 1000 // meters

                if (d < minDist) {
                    minDist = d
                    snappedPoint = closest
                    // Calculate segment bearing
                    bestSegmentHeading = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng)
                }
            }

            // SNAP THRESHOLD: 25 METERS
            if (minDist < 25 && snappedPoint) {
                targetLat = snappedPoint.lat
                targetLng = snappedPoint.lng
                targetBearing = bestSegmentHeading // Use road heading!
            }
        }

        // 3. BEARING SMOOTHING
        // Only update bearing if we moved significantly (snapped or raw) to prevent "spinning"
        const startPos = lastMarkerPos.current || { lat: targetLat, lng: targetLng }
        const distMoved = haversine(startPos.lat, startPos.lng, targetLat, targetLng) * 1000

        if (distMoved > 2) {
            // If we didn't snap, calculate raw bearing from movement
            if (!isRideActive || !currentRouteRef.current) {
                targetBearing = calculateBearing(startPos.lat, startPos.lng, targetLat, targetLng)
            }
            lastBearing.current = targetBearing
        }

        const finalLatLng = { lat: targetLat, lng: targetLng }

        // 4. MAP CAMERA FOLLOW (Smooth "Over-the-Shoulder" view)
        if (isRideActive && isFollowing) {
            mapInstance.current.getViewModel().setLookAtData({
                position: finalLatLng,
                heading: lastBearing.current,
                zoom: 17,
                tilt: 45 // 3D effect!
            }, true)
        }

        // 5. UPDATE MARKER (Create or Animate)
        if (!driverMarker.current) {
            // ... (Init Marker Code - Same as before but localized)
            // For brevity, using the existing init logic would be better if extracted, 
            // but I will recreate the marker here to ensure "Premium" SVG is used.
            const iconMarkup = `
                <div style="width: 0px; height: 0px; position: relative;">
                    <div class="inner-driver-icon driver-marker-premium" style="position: absolute; top: -24px; left: -24px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
                        <svg width="48" height="48" viewBox="0 0 48 48" style="display: block;">
                            <defs>
                                <radialGradient id="pinkGrad" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stop-color="#E91E63" />
                                    <stop offset="100%" stop-color="#C2185B" />
                                </radialGradient>
                            </defs>
                            <circle cx="24" cy="24" r="18" fill="white" />
                            <circle cx="24" cy="24" r="15" fill="url(#pinkGrad)" />
                            <path d="M24 12 L17 28 L24 25 L31 28 Z" fill="white" />
                        </svg>
                    </div>
                </div>
            `
            const icon = new window.H.map.DomIcon(iconMarkup)
            driverMarker.current = new window.H.map.DomMarker(finalLatLng, { icon })
            mapInstance.current.addObject(driverMarker.current)
            lastMarkerPos.current = finalLatLng
        } else {
            // ANIMATION LOOP
            const iconElement = driverMarker.current.getIcon().getElement()
            if (iconElement) {
                const innerIcon = iconElement.querySelector('.inner-driver-icon')
                if (innerIcon) {
                    // Smooth rotation
                    innerIcon.style.transform = `rotate(${lastBearing.current}deg)`
                    innerIcon.style.transition = `transform ${duration}ms linear` // Adaptive speed
                }
            }

            const startTime = performance.now()
            const animate = (time) => {
                const elapsed = time - startTime
                const progress = Math.min(elapsed / duration, 1) // Use adaptive duration

                const cLat = startPos.lat + (targetLat - startPos.lat) * progress
                const cLng = startPos.lng + (targetLng - startPos.lng) * progress

                driverMarker.current.setGeometry({ lat: cLat, lng: cLng })

                if (progress < 1) animationFrameRef.current = requestAnimationFrame(animate)
                else lastMarkerPos.current = finalLatLng
            }
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = requestAnimationFrame(animate)
        }
    }

    const resetFollowMode = () => {
        setIsFollowing(true)
        if (mapInstance.current && latestCoords.current) {
            // USANDO MÉTODO HERO PROFISSIONAL: Sincroniza posição e zoom num único mergulho suave
            mapInstance.current.getViewModel().setLookAtData({
                position: latestCoords.current,
                zoom: 17
            }, true)
        }
    }

    // SOCKET & TERMINATION
    useEffect(() => {
        if (!user) return
        fetchStats()
        socketRef.current = io(SOCKET_URL)
        socketRef.current.on('connect', () => socketRef.current.emit('join', { userId: user.id, role: 'driver' }))
        socketRef.current.on('login_status', (s) => { setIsOnline(s.isOnline); if (s.isOnline) fetchPendingTrips(true) })
        socketRef.current.on('new_trip_available', (t) => {
            setRequests(prev => prev.find(r => r.id === t.id) ? prev : [t, ...prev])
            toast.success('NOVA CORRIDA!', { icon: '🏎️' })
        })
        socketRef.current.on('trip_cancelled', () => { toast.error('Corrida cancelada.'); resetToIdle() })
        socketRef.current.on('restore_ride', (t) => { setActiveRide(t); setRideStatus(t.status) })
        return () => { socketRef.current?.disconnect() }
    }, [user?.id])

    const handleToggleStatus = () => {
        if (activeRide) { toast.error('Finalize a corrida primeiro!'); return }
        const next = !isOnline; setIsOnline(next)
        if (!next) setRequests([])
        socketRef.current?.emit('toggle_online', { userId: user?.id, isOnline: next })
    }

    const handleAcceptRide = (req) => {
        socketRef.current?.emit('accept_trip', { tripId: req.id, driverId: user?.id, clientId: req.clientId, driverName: user?.full_name }, (res) => {
            if (res?.success) {
                localStorage.removeItem('tot_route_cache') // Clear old cache
                setActiveRide(req)
                setRideStatus('accepted')
                setRequests([])
                setFare(parseFloat(req.price) || 1500)
                setForceRouteUpdate(p => p + 1) // Force immediate routing
            }
        })
    }

    const handleStartRide = () => {
        if (!activeRide) return
        socketRef.current?.emit('start_ride', { tripId: activeRide.id, clientId: activeRide.clientId })
        localStorage.removeItem('tot_route_cache') // Force new route (to destination)
        setRideStatus('ongoing')
        setForceRouteUpdate(p => p + 1) // Force immediate routing
    }

    const startTaximeter = () => {
        if (fareInterval.current) clearInterval(fareInterval.current)
        fareInterval.current = setInterval(() => {
            try {
                if (!activeRide?.started_at) return
                const elapsed = (new Date() - new Date(activeRide.started_at)) / 60000
                const currentFare = Math.ceil((Number(activeRide.base_fare || 500) + (elapsed * Number(activeRide.price_per_min || 50))) / 10) * 10
                setFare(currentFare)
                if (new Date().getSeconds() % 10 === 0) socketRef.current?.emit('trip_progress', { tripId: activeRide.id, clientId: activeRide.clientId, currentFare, coords: latestCoords.current })
            } catch (e) { console.error('Taximeter error:', e) }
        }, 1000)
    }

    useEffect(() => { if (rideStatus === 'ongoing' && activeRide?.started_at) startTaximeter(); return () => clearInterval(fareInterval.current) }, [rideStatus, activeRide?.started_at])

    const handleCancelRide = () => {
        if (activeRide) socketRef.current?.emit('cancel_trip', { tripId: activeRide.id, userId: user?.id, role: 'driver' })
        resetToIdle()
    }
    const handleFinishRide = () => {
        if (!activeRide) return
        socketRef.current?.emit('finish_ride', { tripId: activeRide.id, clientId: activeRide.clientId, finalFare: fare.toString() })
        setRideStatus('finished')
        clearMapObjects()
        localStorage.removeItem('tot_route_cache')
    }
    const handleConfirmPayment = () => {
        if (!activeRide) return
        socketRef.current?.emit('confirm_payment', { tripId: activeRide.id, clientId: activeRide.clientId, receiptData: { id: activeRide.id, driver: user?.full_name, total: fare, date: new Date().toLocaleString() } })
        setRideStatus('paid')
    }

    return (
        <div className="driver-dashboard-mobile">
            {/* SIDEBAR & BACKDROP */}
            {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>}

            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="user-profile">
                        <div className="avatar-circle pink shadow"><User size={30} color="white" /></div>
                        <div className="user-info">
                            <h3>{user?.full_name || 'Motorista TOT'}</h3>
                            <p>{user?.phone || '9XXXXXXXX'}</p>
                        </div>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    <button className="nav-item active" onClick={() => setIsSidebarOpen(false)}>
                        <Home size={22} />
                        <span>Início</span>
                    </button>
                    <button className="nav-item" onClick={() => navigate('/history')}>
                        <History size={22} />
                        <span>Meus Ganhos</span>
                    </button>
                    <button className="nav-item" onClick={signOut}><LogOut size={22} /> <span>Sair</span></button>
                </nav>
            </aside>

            {/* BACKGROUND MAP */}
            <div className="dashboard-map-background">
                <HereMap center={latestCoords.current} zoom={16} onMapReady={map => {
                    mapInstance.current = map
                    map.addEventListener('dragstart', () => setIsFollowing(false))
                }} />
                <button className={`map-center-btn ${!isFollowing ? 'visible' : ''}`} onClick={resetFollowMode} style={{ bottom: isRideActive ? '280px' : '150px' }}>
                    <Crosshair size={26} color="#E91E63" />
                </button>
            </div>

            {!isRideActive && (
                <div className="content-layer main-idle">
                    <header className="dash-header-premium">
                        <div className="header-top">
                            <button className="icon-btn" onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
                            <h1 className="logo-text-small">TOT</h1>
                            <div className="profile-mini"><User size={20} /></div>
                        </div>
                        <div className={`status-pill-big ${isOnline ? 'online' : 'offline'}`}>
                            <span className="status-text">{isOnline ? 'VOCÊ ESTÁ ONLINE' : 'VOCÊ ESTÁ OFFLINE'}</span>
                            <button className={`toggle-switch ${isOnline ? 'active' : ''}`} onClick={handleToggleStatus}><Power size={22} color={isOnline ? '#fff' : '#94a3b8'} /></button>
                        </div>
                    </header>
                    <main className="dash-body">
                        <section className="welcome-banner"><h2>Olá, {user?.full_name?.split(' ')[0] || 'Motorista'}! 👋</h2><p>Bons lucros hoje!</p></section>
                        <section className="stats-grid-premium">
                            <div className="stat-card-gradient pink-grad"><Navigation size={22} /><div className="stat-content"><span className="stat-label">Corridas</span><span className="stat-value">{stats.rides}</span></div></div>
                            <div className="stat-card-gradient purple-grad"><DollarSign size={22} /><div className="stat-content"><span className="stat-label">Ganhos</span><span className="stat-value">Kz {Number(stats.earnings || 0).toLocaleString()}</span></div></div>
                        </section>
                        <section className="requests-section">
                            <div className="section-header"><h3>Solicitações</h3><span className="badge-pulse">{requests.length}</span></div>
                            <div className="requests-list">
                                {isOnline ? (requests.length > 0 ? requests.map(req => (
                                    <div key={req?.id} className="request-card shadow-sm">
                                        <div className="req-header"><div className="user-info-mini"><div className="avatar-letter">{req?.userName?.[0] || 'U'}</div><strong>{req?.userName}</strong></div><div className="price-tag-req">Kz {req?.price}</div></div>
                                        <div className="req-route-info"><p>De: {req?.pickupAddress}</p><p>Para: {req?.destAddress}</p></div>
                                        <button className="btn-accept" onClick={() => handleAcceptRide(req)}>ACEITAR</button>
                                    </div>
                                )) : <div className="empty-state-requests"><p>Procurando...</p></div>) : <div className="offline-state-box"><p>Fique online para receber corridas</p></div>}
                            </div>
                        </section>
                    </main>
                </div>
            )}

            {isRideActive && activeRide && (
                <div className="content-layer active-ride">
                    {/* [PREMIUM] GPS Status Badge */}
                    {isGpsLost && (
                        <div style={{
                            position: 'absolute',
                            top: '80px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(239, 68, 68, 0.95)',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            zIndex: 1000,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: 'white',
                                animation: 'pulse 1s infinite'
                            }} />
                            Sem sinal GPS
                        </div>
                    )}
                    <div className="active-ride-nav-card shadow-lg">
                        <div className="nav-card-icon-box">{currentManeuver ? getManeuverIcon(currentManeuver.action) : <ArrowUp size={30} />}</div>
                        <div className="nav-card-content">
                            <div className={`nav-distance-main ${currentManeuver?.isTurnNow ? 'pulse-urgent' : ''}`}>
                                {currentManeuver ? (
                                    currentManeuver.isTurnNow ? 'AGORA!' : `${currentManeuver.dynamicDistance || currentManeuver.length}m`
                                ) : '---'}
                            </div>
                            <div className="nav-instruction-main">{currentManeuver ? translateInstruction(currentManeuver.instruction) : 'Siga a rota'}</div>
                        </div>
                        <div className="nav-card-stats">
                            <div className="nav-stat-row"><Clock size={14} /><span>{rideStats.time}</span></div>
                            <div className="nav-stat-row"><Navigation size={14} /><span>{rideStats.distance}</span></div>
                            <div className="nav-price-tag">{Number(fare).toLocaleString()} Kz</div>
                        </div>
                    </div>

                    <div className={`active-ride-bottom-sheet shadow-lg ${isModalMinimized ? 'minimized' : ''}`}>
                        <div className="sheet-header-row">
                            <div className="client-info-group">
                                <div className="client-pic">{activeRide.userName?.[0] || 'U'}</div>
                                <div className="client-texts"><h4>{activeRide.userName}</h4><span>Cliente TOT Premium</span></div>
                            </div>
                            <button className="btn-minimize-sheet" onClick={() => setIsModalMinimized(true)}><Minimize2 size={20} /></button>
                        </div>
                        <div className="destination-info">
                            <span className="dest-label">{rideStatus === 'accepted' ? 'BUSCAR O CLIENTE EM:' : 'DESTINO DA VIAGEM:'}</span>
                            <div className="info-row"><MapPin size={18} color="#E91E63" /><span className="text-truncate">{rideStatus === 'accepted' ? activeRide.pickupAddress : activeRide.destAddress}</span></div>
                        </div>
                        <div className="sheet-actions-grid"><button className="action-btn-secondary"><Phone size={18} /> Ligar</button><button className="action-btn-secondary"><MessageSquare size={18} /> Chat</button></div>
                        <div className="main-action-slider">
                            {rideStatus === 'accepted' && <button className="btn-main-action start" onClick={handleStartRide}><Play size={20} /> INICIAR</button>}
                            {rideStatus === 'ongoing' && <button className="btn-main-action finish" onClick={handleFinishRide}><Square size={20} /> FINALIZAR</button>}
                            {rideStatus === 'finished' && <button className="btn-main-action pay" onClick={handleConfirmPayment}><CreditCard size={20} /> RECEBER</button>}
                            {rideStatus === 'paid' && <button className="btn-main-action start" onClick={resetToIdle}>CONCLUIR</button>}
                        </div>
                    </div>
                    {isModalMinimized && <button className="ride-restore-btn shadow-lg" onClick={() => setIsModalMinimized(false)}><Maximize2 size={24} /></button>}
                </div>
            )}
        </div>
    )
}
