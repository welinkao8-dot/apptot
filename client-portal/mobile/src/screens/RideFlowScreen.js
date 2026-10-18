import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Animated,
    Dimensions,
    Image,
    ScrollView,
    TextInput,
    Keyboard,
    Platform,
    Alert,
    BackHandler,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentClientLocation } from '../services/currentLocation';
import {
    Menu,
    Search,
    Navigation,
    MapPin,
    Clock,
    Package,
    Bike,
    Car,
    Truck,
    Star,
    Shield,
    CheckCircle,
    X,
    Heart,
    User,
    ArrowLeft,
    Smartphone,
    CreditCard,
    Map
} from 'lucide-react-native';
import colors from '../theme/colors';
import socket, { setSocketToken } from '../services/socket';
import api from '../services/api';
import { toSafeErrorLog } from '../utils/safeErrorLog';
import hereService from '../services/hereService';
import HereMap from '../components/HereMap';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';
import { drawSelectedQuoteRoute, isQuoteExpired, mergeQuotesWithServices } from '../utils/quoteSelection';
import DriverLocationStatus from '../components/DriverLocationStatus';
import { formatCoordinateLabel, isValidCoordinate, validateTripLocations } from '../utils/tripLocation';

const { width, height } = Dimensions.get('window');

const SEARCH_FEEDBACK = {
    no_results: { message: 'Nenhum endereço encontrado. Tenta outro nome ou seleciona no mapa.', retryable: false },
    timeout: { message: 'A pesquisa demorou demasiado. Verifica a ligação e tenta novamente.', retryable: true },
    offline: { message: 'Sem ligação à internet. As sugestões anteriores continuam disponíveis.', retryable: true },
    rate_limited: { message: 'Muitas pesquisas em pouco tempo. Aguarda um pouco e tenta novamente.', retryable: true },
    server_error: { message: 'A pesquisa está temporariamente indisponível. Tenta novamente.', retryable: true },
    request_error: { message: 'Não foi possível pesquisar este endereço. Confirma o texto e tenta novamente.', retryable: false },
};

export function normalizeSuggestionSearchResult(result) {
    const results = Array.isArray(result) ? result : [];
    const status = result?.status || (results.length ? 'success' : 'no_results');
    const feedback = SEARCH_FEEDBACK[status];
    return {
        results,
        status,
        message: status === 'loading' ? 'A procurar endereços…' : (feedback?.message || ''),
        retryable: Boolean(result?.retryable ?? feedback?.retryable),
    };
}

export default function RideFlowScreen({ navigation, route }) {
    const { user, token } = useAuth();
    // Default to 'searching_address' if opened from Search Input, or 'home' otherwise
    const [step, setStep] = useState(route.params?.initialStep || 'home');
    const [loading, setLoading] = useState(false);
    const [destination, setDestination] = useState(null);
    const [isRestored, setIsRestored] = useState(false); // [NEW] Flag for restored sessions
    const [pickupAddress, setPickupAddress] = useState('A obter localização...');
    const [pickupCoords, setPickupCoords] = useState(route.params?.pickupCoords || null);
    const [selectedService, setSelectedService] = useState(null);
    const [availableServices, setAvailableServices] = useState([]);
    const [calculatedServices, setCalculatedServices] = useState([]);
    const [quotesLoading, setQuotesLoading] = useState(false);
    const [quoteError, setQuoteError] = useState(null);
    const [tripId, setTripId] = useState(null);
    const [activeRoutePolyline, setActiveRoutePolyline] = useState(null);
    const [acceptedDriver, setAcceptedDriver] = useState(null);
    const [driverLocationUpdatedAt, setDriverLocationUpdatedAt] = useState(null);
    const [currentFare, setCurrentFare] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchStatus, setSearchStatus] = useState('idle');
    const [searchAttempt, setSearchAttempt] = useState(0);
    const [mapReady, setMapReady] = useState(false);
    const [selectingPickup, setSelectingPickup] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);

    const mapRef = useRef(null);
    const tripIdRef = useRef(tripId);
    const setCurrentTripId = (id) => {
        tripIdRef.current = id;
        setTripId(id);
    };
    const pickupCoordsRef = useRef(pickupCoords);
    const mapReadyRef = useRef(mapReady);
    const quoteRequestIdRef = useRef(0);
    const quoteContextRef = useRef(null);
    const tripSubmissionIdRef = useRef(0);
    const tripSubmissionInFlightRef = useRef(false);
    const searchRequestIdRef = useRef(0);
    const mapTapRequestIdRef = useRef(0);
    const locationRequestIdRef = useRef(0);
    const isMountedRef = useRef(false);
    const radarAnim = useRef(new Animated.Value(0)).current;
    const paymentAnim = useRef(new Animated.Value(0)).current;

    const locatePickup = async (fromButton = false) => {
        const requestId = ++locationRequestIdRef.current;
        mapTapRequestIdRef.current += 1;
        setLocationLoading(true);
        try {
            const result = await getCurrentClientLocation();
            if (!isMountedRef.current || requestId !== locationRequestIdRef.current) return;
            if (result.status === 'granted') {
                invalidateQuoteSelection();
                setPickupCoords(result.coords);
                pickupCoordsRef.current = result.coords;
                setPickupAddress('A obter endereço…');
                setSelectingPickup(false);
                if (mapRef.current) mapRef.current.setUserLocation(result.coords);
                const address = await hereService.reverseGeocode(result.coords.lat, result.coords.lng);
                if (isMountedRef.current && requestId === locationRequestIdRef.current) {
                    setPickupAddress(address || formatCoordinateLabel(result.coords));
                }
            } else if (result.status === 'blocked') {
                Toast.show({ type: 'info', text1: 'Localização bloqueada', text2: 'Pode marcar a recolha no mapa ou ativar a permissão nas definições.' });
                if (fromButton) Alert.alert('Permissão de localização', 'Ative a localização nas definições do telemóvel ou escolha a recolha no mapa.', [
                    { text: 'Escolher no mapa', style: 'cancel', onPress: () => setSelectingPickup(true) },
                    { text: 'Abrir definições', onPress: () => Linking.openSettings() },
                ]);
            } else if (result.status === 'denied') {
                Toast.show({ type: 'info', text1: 'Permissão recusada', text2: 'Pode continuar ao marcar a recolha no mapa.' });
            } else {
                setPickupAddress('Localização indisponível — escolha o ponto no mapa.');
                if (fromButton) Toast.show({ type: 'error', text1: 'Localização indisponível', text2: 'Verifique o GPS ou escolha a recolha no mapa.' });
            }
        } finally {
            if (isMountedRef.current && requestId === locationRequestIdRef.current) setLocationLoading(false);
        }
    };

    // Keep refs in sync
    useEffect(() => { pickupCoordsRef.current = pickupCoords; }, [pickupCoords]);
    useEffect(() => { mapReadyRef.current = mapReady; }, [mapReady]);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            quoteRequestIdRef.current += 1;
            tripSubmissionIdRef.current += 1;
            tripSubmissionInFlightRef.current = false;
            searchRequestIdRef.current += 1;
            mapTapRequestIdRef.current += 1;
            locationRequestIdRef.current += 1;
        };
    }, []);

    // --- Effects ---

    // 0. Update pickup from params if provided (e.g. passed from Dashboard)
    useEffect(() => {
        if (route.params?.pickupCoords) {
            if (route.params.pickupCoords.lat !== pickupCoordsRef.current?.lat
                || route.params.pickupCoords.lng !== pickupCoordsRef.current?.lng) {
                invalidateQuoteSelection();
            }
            setPickupCoords(route.params.pickupCoords);
            if (mapReady && mapRef.current) {
                mapRef.current.setUserLocation(route.params.pickupCoords);
            }
        }
        if (route.params?.pickupAddress) setPickupAddress(route.params.pickupAddress);
    }, [route.params]);

    // 1. Initial GPS (Backup if not passed) & Service Load
    useEffect(() => {
        loadServices();
        if (!route.params?.pickupCoords) {
            void locatePickup();
        }

        // Ensure socket is alive
        setSocketToken(token);
        if (!socket.connected) {
            console.log('📡 [RideFlow] Estabelecendo conexão inicial do socket...');
            socket.connect();
        }
    }, [token]);

    const checkActiveRide = async () => {
        try {
            console.log('🔍 [RideFlow] Verificando corrida ativa no servidor para usuário:', user.id);
            const res = await api.get(`/trips/active/${user.id}`);
            const activeTrips = res?.data;

            // Extract the ride from the array (if it's an array)
            const trip = Array.isArray(activeTrips) ? activeTrips.find(t => t.category === 'ride') : activeTrips;

            if (trip && trip.id) {
                console.log('✅ [RideFlow] Corrida ativa encontrada:', trip.id, 'Status:', trip.status);
                setIsRestored(true); // [NEW] Mark as restored session to show sync button

                // Map server status to UI step
                let uiStep = 'home';
                if (trip.status === 'requested') uiStep = 'requesting';
                else if (trip.status === 'accepted') uiStep = 'accepted';
                else if (trip.status === 'ongoing') uiStep = 'ongoing';
                else if (trip.status === 'completed') uiStep = 'waiting_payment';

                const dest = {
                    name: trip.dest_address?.split(',')[0] || 'Destino',
                    address: trip.dest_address,
                    lat: parseFloat(trip.dest_lat),
                    lng: parseFloat(trip.dest_lng)
                };

                setCurrentTripId(trip.id);
                setActiveRoutePolyline(trip.route_polyline || null);
                setStep(uiStep);
                setDestination(dest);
                // Use current_fare (live value) if available, otherwise fall back to estimated_fare
                setCurrentFare(parseFloat(trip.current_fare || trip.final_fare || trip.estimated_fare || 0));

                if (trip.profiles_trips_driver_idToprofiles) {
                    setAcceptedDriver({
                        id: trip.driver_id,
                        name: trip.profiles_trips_driver_idToprofiles.full_name,
                        lat: trip.driver_lat,
                        lng: trip.driver_lng
                    });
                }

                // Restore origin coordinates for map and UI
                if (trip.origin_lat && trip.origin_lng) {
                    const origin = { lat: parseFloat(trip.origin_lat), lng: parseFloat(trip.origin_lng) };
                    setPickupCoords(origin);
                    if (trip.origin_address) setPickupAddress(trip.origin_address);

                    // IF we have map ready, draw it now
                    if (mapReady && mapRef.current) {
                        mapRef.current.setMarkers(origin, { lat: dest.lat, lng: dest.lng });
                    }
                }
            } else {
                console.log('ℹ️ [RideFlow] Nenhuma corrida ativa no servidor.');
                const currentTripId = tripIdRef.current;
                if (!currentTripId) return;

                const persisted = (await api.get(`/trips/${currentTripId}`)).data;
                if (persisted?.status === 'completed' && persisted.trip_payment?.status === 'confirmed') {
                    setCurrentTripId(persisted.id);
                    const fare = Number(persisted.final_fare ?? persisted.estimated_fare ?? persisted.trip_payment.amount);
                    if (Number.isFinite(fare)) setCurrentFare(fare);
                    setStep('finished');
                } else if (persisted?.status === 'cancelled') {
                    resetFlow();
                }
            }
        } catch (error) {
            console.error('❌ [RideFlow] Erro ao verificar corrida ativa:', toSafeErrorLog(error));
        }
    };

    // 2. Map Auto-Restore and Dynamic Adjustment
    useEffect(() => {
        if (mapReady && destination && step !== 'searching_address') {
            mapRef.current?.setMarkers(pickupCoords, { lat: destination.lat, lng: destination.lng });
            if (activeRoutePolyline) mapRef.current?.drawRoute(activeRoutePolyline);
            
            if (step === 'service_selection' || step === 'requesting' || step === 'accepted' || step === 'ongoing') {
                if (acceptedDriver) {
                    mapRef.current?.setDriverPosition({ lat: acceptedDriver.lat, lng: acceptedDriver.lng });
                }
            }
        }
    }, [mapReady, step, destination, pickupCoords, acceptedDriver, activeRoutePolyline]);

    // 3. Search Logic
    useEffect(() => {
        const requestId = ++searchRequestIdRef.current;
        const delay = setTimeout(async () => {
            if (searchQuery.length >= 3) {
                setSearchStatus('loading');
                try {
                    const result = await hereService.fetchSuggestions(searchQuery, pickupCoords);
                    if (requestId === searchRequestIdRef.current) {
                        const normalized = normalizeSuggestionSearchResult(result);
                        setSearchResults(normalized.results);
                        setSearchStatus(normalized.status);
                    }
                } catch (error) {
                    if (requestId === searchRequestIdRef.current) setSearchStatus('server_error');
                }
            } else {
                setSearchResults([]);
                setSearchStatus('idle');
            }
        }, 500);
        return () => {
            clearTimeout(delay);
            searchRequestIdRef.current += 1;
        };
    }, [searchQuery, searchAttempt]);

    const handleSearchQueryChange = (query) => {
        setSearchResults([]);
        setSearchStatus('idle');
        setSearchQuery(query);
    };

    // 4. Animation Loops
    useEffect(() => {
        if (step === 'requesting') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(radarAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
                    Animated.timing(radarAnim, { toValue: 0, duration: 0, useNativeDriver: false })
                ])
            ).start();
        } else {
            radarAnim.setValue(0);
        }

        if (step === 'waiting_payment') {
            Animated.loop(
                Animated.timing(paymentAnim, { toValue: 1, duration: 4000, useNativeDriver: false }) // Slower rotation
            ).start();
        } else {
            paymentAnim.setValue(0);
        }
    }, [step]);

    // 5. Back Handler (With Safety Valve)
    const lastBackPress = useRef(0);
    useEffect(() => {
        const backAction = () => {
            const now = Date.now();
            if (['requesting', 'accepted', 'ongoing', 'payment'].includes(step)) {
                // Safety Valve: Double press to force exit
                if (now - lastBackPress.current < 2000) {
                    resetFlow();
                    // Force navigation back to Dashboard
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'App', params: { screen: 'Dashboard' } }],
                    });
                    return true;
                }

                lastBackPress.current = now;
                Toast.show({
                    type: 'info',
                    text1: 'Atenção',
                    text2: 'Pressione novamente para sair forçadamente (apenas se travado)'
                });
                return true; // Block single press
            }

            if (step === 'searching_address' || step === 'service_selection') {
                if (step === 'service_selection') invalidateTripSubmission();
                setStep('home');
                return true;
            }

            // If at home, go back to Dashboard
            navigation.navigate('App', { screen: 'Dashboard' });
            return true;
        };
        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, [step]);

    // --- Socket Listeners (The Vault Logic) ---
    useEffect(() => {
        if (!user) return; // Guard: user logged out, skip socket setup

        const onConnect = () => {
            console.log('📡 [RideFlow] Socket Conectado - Emitindo join');
            if (!user) return; // Guard against null user after logout
            socket.emit('join');
            void checkActiveRide();
        };

        // If socket is already connected when component mounts or restores, join immediately
        if (socket.connected) {
            onConnect();
        }

        const onTripCreated = (data) => {
            console.log('✅ [RideFlow] Trip criada via socket:', data.tripId);
            setCurrentTripId(data.tripId);
            setStep('requesting');
        };

        const onTripAccepted = (data) => {
            console.log('👋 [RideFlow] Trip aceita pelo motorista:', data.driver.id);
            setAcceptedDriver(data.driver);
            setStep('accepted');
            if (mapRef.current) mapRef.current.setDriverPosition({ lat: data.driver.lat, lng: data.driver.lng });
        };

        const onRideStarted = () => {
            console.log('🛣️ [RideFlow] Viagem iniciada');
            setStep('ongoing');
        };

        const onTripUpdate = (data) => {
            if (data.currentFare) setCurrentFare(data.currentFare);
            // Backend sends coords as { lat, lng } object inside data.coords
            const lat = data.coords?.lat ?? data.driverLat;
            const lng = data.coords?.lng ?? data.driverLng;
            if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
                setDriverLocationUpdatedAt(Number.isFinite(Number(data.timestamp)) ? Number(data.timestamp) : Date.now());
            }
            if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && mapRef.current) {
                mapRef.current.setDriverPosition({ lat, lng });
            }
        };

        const onRideFinished = (data) => {
            console.log('🏁 [RideFlow] Viagem finalizada');
            setStep('waiting_payment');
            setCurrentFare(data.finalFare);
            mapRef.current?.clearMap();
            if (mapRef.current && pickupCoordsRef.current) mapRef.current.setUserLocation(pickupCoordsRef.current);
        };

        const onPaymentConfirmed = (data) => {
            console.log('💰 [RideFlow] Pagamento confirmado');
            setStep('finished');
            if (data.finalFare) setCurrentFare(data.finalFare);
        };

        const onTripCancelled = () => {
            console.log('🚫 [RideFlow] Viagem cancelada via socket');
            resetFlow();
            Toast.show({ type: 'info', text1: 'Cancelado', text2: 'A viagem foi cancelada.' });
        };

        const onTripError = (data) => {
            console.log('❌ [RideFlow] Erro de Trip no Socket:', data);
        };

        socket.on('connect', onConnect);
        socket.on('trip_created', onTripCreated);
        socket.on('trip_accepted', onTripAccepted);
        socket.on('ride_started', onRideStarted);
        socket.on('trip_update', onTripUpdate);
        socket.on('ride_finished', onRideFinished);
        socket.on('payment_confirmed', onPaymentConfirmed);
        socket.on('trip_cancelled', onTripCancelled);
        socket.on('trip_timeout', onTripCancelled);
        socket.on('trip_error', onTripError);

        return () => {
            socket.off('connect', onConnect);
            socket.off('trip_created', onTripCreated);
            socket.off('trip_accepted', onTripAccepted);
            socket.off('ride_started', onRideStarted);
            socket.off('trip_update', onTripUpdate);
            socket.off('ride_finished', onRideFinished);
            socket.off('payment_confirmed', onPaymentConfirmed);
            socket.off('trip_cancelled', onTripCancelled);
            socket.off('trip_timeout', onTripCancelled);
            socket.off('trip_error', onTripError);
        };
    }, [user?.id]); // Use optional chaining to avoid crash when user is null after logout



    const loadServices = async () => {
        try {
            const res = await api.getServices();
            setAvailableServices(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const invalidateQuoteSelection = () => {
        quoteRequestIdRef.current += 1;
        quoteContextRef.current = null;
        setActiveRoutePolyline(null);
        setCalculatedServices([]);
        setSelectedService(null);
        setQuoteError(null);
        setQuotesLoading(false);
        try {
            mapRef.current?.drawRoute?.(null);
        } catch (error) {
            console.warn('Could not clear the previous quote route:', toSafeErrorLog(error));
        }
    };

    const invalidateTripSubmission = () => {
        tripSubmissionIdRef.current += 1;
        tripSubmissionInFlightRef.current = false;
        setLoading(false);
    };

    const leaveQuoteSelection = () => {
        invalidateTripSubmission();
        setStep('home');
    };

    const calculateFares = async (destLat, destLng, customOrigin = null, customDestination = destination, customOriginAddress = pickupAddress) => {
        invalidateQuoteSelection();
        const origin = customOrigin || pickupCoords;
        if (!origin) {
            setQuoteError('Ative a localização ou escolha o ponto de recolha no mapa.');
            Toast.show({ type: 'error', text1: 'Ponto de recolha necessário', text2: 'Ative a localização ou escolha o ponto de recolha no mapa.' });
            return;
        }
        const originLabel = customOriginAddress?.trim() && customOriginAddress !== 'A obter localização...'
            ? customOriginAddress.trim()
            : `${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}`;
        const destinationLabel = (customDestination?.address || customDestination?.name || '').trim()
            || `${destLat}, ${destLng}`;
        const locationValidation = validateTripLocations(origin, { lat: destLat, lng: destLng }, originLabel, destinationLabel);
        if (!locationValidation.valid) {
            setQuoteError(locationValidation.reason === 'same_location'
                ? 'A origem e o destino têm de ser diferentes.'
                : 'Confirme um ponto de recolha e um destino válidos no mapa.');
            return;
        }
        mapRef.current?.setMarkers(origin, { lat: destLat, lng: destLng });

        const requestId = ++quoteRequestIdRef.current;
        const quoteContext = { originLat: origin.lat, originLng: origin.lng, destLat, destLng };
        setQuotesLoading(true);
        setQuoteError(null);
        try {
            const response = await api.post('/quotes', {
                category: 'ride',
                originAddress: originLabel,
                destAddress: destinationLabel,
                originLat: origin.lat,
                originLng: origin.lng,
                destLat,
                destLng,
            });
            if (requestId !== quoteRequestIdRef.current) return;
            const quotes = mergeQuotesWithServices(availableServices, response.data, 'ride');
            const firstRoute = quotes.find(service => service.routePolyline)?.routePolyline;
            setActiveRoutePolyline(firstRoute || null);
            if (firstRoute) mapRef.current?.drawRoute(firstRoute);
            if (quotes.length > 0) quoteContextRef.current = quoteContext;
            setCalculatedServices(quotes);
            if (quotes.length === 0) setQuoteError('Não há opções de viagem disponíveis para este percurso.');
        } catch (error) {
            if (requestId !== quoteRequestIdRef.current) return;
            setCalculatedServices([]);
            setQuoteError('Não foi possível calcular os preços. Verifique a ligação e tente novamente.');
        } finally {
            if (requestId === quoteRequestIdRef.current) setQuotesLoading(false);
        }
    };

    const handleSelectDestination = (item) => {
        mapTapRequestIdRef.current += 1;
        Keyboard.dismiss();
        invalidateQuoteSelection();
        setDestination(item);
        setSearchQuery(item.address || item.name);
        setStep('home'); // Go back to map view (home state of this screen)

        // Sync Map
        if (mapRef.current && pickupCoords) {
            const dest = { lat: item.lat, lng: item.lng };
            mapRef.current.setMarkers(pickupCoords, dest);
            calculateFares(item.lat, item.lng, pickupCoords, item, pickupAddress);
        }
    };

    const onMapTap = async (coords) => {
        if (step !== 'home' && step !== 'searching_address') return;
        if (!isValidCoordinate(coords)) return;
        const requestId = ++mapTapRequestIdRef.current;
        const wasSelectingPickup = selectingPickup;
        if (wasSelectingPickup) {
            locationRequestIdRef.current += 1;
            setLocationLoading(false);
        }
        const address = await hereService.reverseGeocode(coords.lat, coords.lng);
        if (!isMountedRef.current || requestId !== mapTapRequestIdRef.current) return;
        if (wasSelectingPickup) {
            invalidateQuoteSelection();
            setPickupCoords(coords);
            pickupCoordsRef.current = coords;
            setPickupAddress(address || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
            setSelectingPickup(false);
            if (mapRef.current) mapRef.current.setUserLocation(coords);
            return;
        }
        const item = {
            name: address ? address.split(',')[0] : formatCoordinateLabel(coords),
            address: address || formatCoordinateLabel(coords),
            lat: coords.lat,
            lng: coords.lng
        };

        handleSelectDestination(item);
    };

    const handleProceedToSelection = () => {
        if (!destination) {
            Toast.show({ type: 'error', text1: 'Destino', text2: 'Selecione um destino primeiro.' });
            return;
        }
        if (calculatedServices.length === 0 && !quotesLoading) {
            // Try calc again
            calculateFares(destination.lat, destination.lng);
        }
        setStep('service_selection');
    };

    const handleSelectService = (service) => {
        if (!quoteContextRef.current) return;
        setSelectedService(service);
        setActiveRoutePolyline(service?.routePolyline || null);
        drawSelectedQuoteRoute(service, mapRef.current);
    };

    const handleRequestTrip = async () => {
        if (loading || tripSubmissionInFlightRef.current) return;

        try {
            console.log('🔵 [RideFlow] Botão CONTINUAR clicado. Iniciando handleRequestTrip...');

            if (!selectedService || !destination) {
                Toast.show({ type: 'error', text1: 'Erro', text2: 'Selecione o destino e o serviço primeiro.' });
                return;
            }

            const quoteContext = quoteContextRef.current;
            if (!quoteContext
                || quoteContext.originLat !== pickupCoords?.lat
                || quoteContext.originLng !== pickupCoords?.lng
                || quoteContext.destLat !== destination.lat
                || quoteContext.destLng !== destination.lng) {
                setSelectedService(null);
                setStep('service_selection');
                Toast.show({ type: 'info', text1: 'Cotação desatualizada', text2: 'Calcule novamente a rota e selecione um preço atualizado.' });
                return;
            }

            if (isQuoteExpired(selectedService)) {
                await calculateFares(destination.lat, destination.lng);
                setSelectedService(null);
                setStep('service_selection');
                setLoading(false);
                Toast.show({ type: 'info', text1: 'Cotação atualizada', text2: 'Confira novamente o preço e selecione o serviço para confirmar.' });
                return;
            }

            tripSubmissionInFlightRef.current = true;
            const requestId = ++tripSubmissionIdRef.current;
            const isCurrentRequest = () => isMountedRef.current && requestId === tripSubmissionIdRef.current;
            const finishRequest = () => {
                if (!isCurrentRequest()) return;
                tripSubmissionInFlightRef.current = false;
                setLoading(false);
            };
            setLoading(true);

            // Check Socket Connection
            if (!socket.connected) {
                console.log('📡 [RideFlow] Socket desconectado! Tentando reconectar...');
                socket.connect();
            }

            if (!selectedService.quoteId) throw new Error('A cotação do serviço não está disponível. Calcule novamente a rota.');
            const payload = { quoteId: selectedService.quoteId };

            console.log('🔵 [RideFlow] Payload:', JSON.stringify(payload, null, 2));

            socket.timeout(10000).emit('request_trip', payload, async (timeoutError, response) => {
                if (!isCurrentRequest()) return;
                if (!timeoutError && response?.success && response.tripId) {
                    setCurrentTripId(response.tripId);
                    setStep('requesting');
                    finishRequest();
                    return;
                }
                try {
                    const active = await api.get(`/trips/active/${user.id}`);
                    if (!isCurrentRequest()) return;
                    const committed = (Array.isArray(active.data) ? active.data : [active.data]).find((trip) => trip?.quote_id === payload.quoteId || trip?.id === response?.tripId);
                    if (committed) {
                        setCurrentTripId(committed.id);
                        setStep('requesting');
                    } else {
                        setStep('service_selection');
                        Toast.show({ type: 'error', text1: 'Pedido não confirmado', text2: response?.error || 'Verifique a ligação e tente novamente.' });
                    }
                } catch {
                    if (!isCurrentRequest()) return;
                    setStep('service_selection');
                    Toast.show({ type: 'error', text1: 'Sem confirmação do servidor', text2: 'Verifique as suas viagens antes de tentar novamente.' });
                } finally {
                    finishRequest();
                }
            });
            console.log('🚀 [RideFlow] Evento request_trip emitido!');

            // Wait for the server ACK or the durable REST reconciliation above.

        } catch (error) {
            console.error('❌ [RideFlow] ERRO FATAL:', toSafeErrorLog(error));
            Toast.show({ type: 'error', text1: 'Erro Fatal', text2: error.message });
            invalidateTripSubmission();
        }
    };

    const resetFlow = async () => {
        console.log('🔄 [RideFlow] Iniciando limpeza profunda do estado...');
        invalidateTripSubmission();
        invalidateQuoteSelection();
        setStep('home');
        setCurrentTripId(null);
        setAcceptedDriver(null);
        setDriverLocationUpdatedAt(null);
        setDestination(null);
        setCurrentFare(0);
        setLoading(false);
        setIsRestored(false);
        setCalculatedServices([]);
        setSelectedService(null);
        setSearchQuery('');

        if (mapRef.current) {
            mapRef.current.clearMap();
            if (pickupCoordsRef.current) mapRef.current.setUserLocation(pickupCoordsRef.current);
        }
        console.log('✅ [RideFlow] Fluxo resetado com sucesso.');
    };

    const handleCancelTrip = () => {
        if (!tripId) {
            resetFlow();
            return;
        }
        console.log('🚫 [RideFlow] Cancelando viagem:', tripId);
        socket.emit('cancel_trip', { tripId });
        resetFlow();
        Toast.show({ type: 'info', text1: 'Cancelado', text2: 'Sua solicitação foi cancelada.' });
    };


    // --- Renders ---

    const renderOverlay = () => {
        const addressSearchFeedback = normalizeSuggestionSearchResult(Object.assign([], { status: searchStatus }));
        switch (step) {
            case 'home':
                // Small bottom sheet to trigger search
                return (
                    <View style={styles.bottomSheet}>
                        <Text style={styles.sheetTitle}>Para onde vamos hoje?</Text>
                        <TouchableOpacity style={[styles.searchBar, destination && styles.searchBarActive]} onPress={() => setStep('searching_address')}>
                            {!destination ? (
                                <>
                                    <MapPin size={20} color={colors.primary} />
                                    <Text style={styles.searchText}>Digite seu destino...</Text>
                                </>
                            ) : (
                                <>
                                    <View style={styles.destinationDot} />
                                    <Text style={styles.searchTextActive}>{destination.name}</Text>
                                    <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={() => {
                                        invalidateQuoteSelection();
                                        setDestination(null);
                                        setSearchQuery('');
                                        mapRef.current?.clearMap();
                                    }}>
                                        <X size={18} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </TouchableOpacity>

                        {destination && (
                            <TouchableOpacity style={styles.primaryBtn} onPress={handleProceedToSelection}>
                                <Text style={styles.primaryBtnText}>Ver Preços</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                );

            case 'searching_address':
                return (
                    <View style={styles.searchContainer}>
                        <SafeAreaView style={{ backgroundColor: '#FFF' }}>
                            <View style={styles.searchHeader}>
                                <TouchableOpacity onPress={() => setStep('home')} style={styles.closeBtn}>
                                    <X size={28} color={colors.text} />
                                </TouchableOpacity>
                                <Text style={styles.headerTitlePink}>PARA ONDE VAIS?</Text>
                                <View style={{ width: 28 }} />
                            </View>

                            <View style={styles.inputsWrapper}>
                                <View style={styles.timelineContainer}>
                                    <View style={styles.blueDot} />
                                    <View style={styles.dottedLine} />
                                    <View style={styles.pinkDot} />
                                </View>
                                <View style={styles.inputsColumn}>
                                    <View style={styles.inputBox}>
                                        <Text style={styles.inputTextStatic}>{pickupAddress}</Text>
                                    </View>
                                    <View style={styles.inputDivider} />
                                    <View style={styles.inputBoxActive}>
                                        <TextInput
                                            style={styles.inputTextActive}
                                            placeholder="Para onde vais?"
                                            placeholderTextColor={colors.textSecondary}
                                            value={searchQuery}
                                            onChangeText={handleSearchQueryChange}
                                            autoFocus
                                        />
                                        {searchQuery.length > 0 && (
                                            <TouchableOpacity onPress={() => handleSearchQueryChange('')}>
                                                <X size={18} color={colors.primary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </SafeAreaView>

                        <ScrollView keyboardShouldPersistTaps="handled" style={styles.resultsList} showsVerticalScrollIndicator={false}>
                            {addressSearchFeedback.message ? (
                                <View style={styles.searchFeedback} accessibilityLiveRegion="polite">
                                    <Text style={styles.searchFeedbackText}>{addressSearchFeedback.message}</Text>
                                    {addressSearchFeedback.retryable && (
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            accessibilityLabel="Tentar novamente a pesquisa de endereços"
                                            style={styles.searchRetryButton}
                                            onPress={() => setSearchAttempt(attempt => attempt + 1)}
                                        >
                                            <Text style={styles.searchRetryText}>Tentar novamente</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ) : null}
                            {searchResults.map((item) => (
                                <TouchableOpacity key={item.id} style={styles.resultItem} onPress={() => handleSelectDestination(item)}>
                                    <View style={styles.resultIconBox}>
                                        <MapPin size={24} color={colors.primary} />
                                    </View>
                                    <View style={styles.resultInfo}>
                                        <Text style={styles.resultName}>{item.name}</Text>
                                        <Text style={styles.resultAddress}>{item.address}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity style={styles.resultItem} onPress={() => setStep('home')}>
                                <View style={styles.resultIconBox}>
                                    <MapPin size={24} color={colors.primary} />
                                </View>
                                <View style={styles.resultInfo}>
                                    <Text style={styles.resultName}>Definir no mapa</Text>
                                    <Text style={styles.resultAddress}>Toque no mapa para selecionar</Text>
                                </View>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                );

            case 'service_selection':
                return (
                    <View style={styles.bottomSheet}>
                        <View style={styles.handleBar} />
                        <View style={styles.selectionHeader}>
                            <Text style={styles.sheetTitleCallback}>SELECIONE UMA VIAGEM</Text>
                            <TouchableOpacity onPress={leaveQuoteSelection} style={styles.backBtn}>
                                <ArrowLeft size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                        {quotesLoading && (
                            <View style={styles.quoteFeedback}>
                                <ActivityIndicator color={colors.primary} />
                                <Text style={styles.quoteFeedbackText}>A calcular rota e preços…</Text>
                            </View>
                        )}
                        {!!quoteError && !quotesLoading && (
                            <View style={styles.quoteFeedback}>
                                <Text style={styles.quoteFeedbackText}>{quoteError}</Text>
                                {!!destination && (
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        onPress={() => calculateFares(destination.lat, destination.lng)}
                                        style={styles.quoteRetryButton}
                                    >
                                        <Text style={styles.quoteRetryText}>Tentar novamente</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        {calculatedServices.map((service) => {
                            const vc = (service.vehicle_category || '').toLowerCase();
                            let ServiceIcon = Car;
                            if (vc.includes('moto')) ServiceIcon = Bike;
                            return (
                                <TouchableOpacity
                                    key={service.id}
                                    style={[styles.serviceItem, selectedService?.id === service.id && styles.serviceItemActive]}
                                    onPress={() => handleSelectService(service)}
                                >
                                    <View style={styles.serviceLeft}>
                                        <View style={styles.serviceIconBox}><ServiceIcon size={32} color={colors.text} /></View>
                                        <View>
                                            <Text style={styles.serviceName}>{service.name}</Text>
                                            <Text style={styles.serviceCapacity}>{(service.distanceMeters / 1000).toFixed(1)} km · {service.estimatedTime} min</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.servicePrice}>{service.estimatedPrice.toLocaleString()} Kz</Text>
                                </TouchableOpacity>
                            );
                        })}
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: (selectedService && !loading) ? colors.primary : '#E2E8F0' }]}
                            disabled={!selectedService || loading}
                            onPress={handleRequestTrip}
                        >
                            <Text style={[styles.primaryBtnText, { color: (selectedService && !loading) ? '#FFF' : '#94A3B8' }]}>
                                {loading ? 'Solicitando...' : 'Continuar'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'requesting':
                return (
                    <View style={styles.overlay}>
                        <View style={styles.radarContainer}>
                            <Animated.View style={[styles.radarRing, {
                                transform: [{ scale: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
                                opacity: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] })
                            }]} />
                            <Navigation size={40} color="#FFF" />
                        </View>
                        <Text style={styles.overlayTitle}>Procurando motorista...</Text>
                        <Text style={styles.overlaySub}>Estamos conectando você aos melhores da TOT</Text>
                        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelTrip}>
                            <Text style={styles.cancelText}>Cancelar Pedido</Text>
                        </TouchableOpacity>

                    </View>
                );

            case 'accepted':
                return (
                    <View style={styles.bottomSheet}>
                        <View style={styles.handleBar} />
                        <View style={styles.acceptedHeader}>
                            <View style={styles.driverAvatarLarge}>
                                <Text style={styles.avatarText}>{acceptedDriver?.name?.[0] || 'D'}</Text>
                            </View>
                            <Text style={styles.acceptedTitle}>Motorista a caminho!</Text>
                            <Text style={styles.acceptedSubtitle}>{acceptedDriver?.name} aceitou o seu pedido</Text>
                        </View>
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={styles.actionBtn}>
                                <Text style={styles.actionBtnText}>Mensagem</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={handleCancelTrip}>
                                <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                );

            case 'ongoing':
                return (
                    <View style={styles.bottomSheet}>
                        <View style={styles.handleBar} />
                        <View style={styles.ongoingHeader}>
                            <View style={styles.statusBadge}>
                                <Text style={styles.statusBadgeText}>VIAGEM EM CURSO</Text>
                            </View>
                            <Text style={styles.ongoingPrice}>{(currentFare || selectedService?.estimatedPrice || 0).toLocaleString()} Kz</Text>
                        </View>

                        <View style={styles.driverMinimalCard}>
                            <View style={styles.driverAvatarSmall}>
                                <Text style={styles.avatarTextSmall}>{acceptedDriver?.name?.[0] || 'D'}</Text>
                            </View>
                            <View style={styles.driverMinimalDetails}>
                                <Text style={styles.driverNameSmall}>{acceptedDriver?.name}</Text>
                                <Text style={styles.driverCarSmall}>Veículo não informado</Text>
                            </View>
                            <TouchableOpacity style={styles.chatIconBtn}>
                                <Smartphone size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>

                    </View>
                );

            case 'waiting_payment':
                return (
                    <View style={styles.overlay}>
                        <View style={styles.paymentCard}>
                            <View style={styles.paymentIconBox}>
                                <CreditCard size={40} color={colors.primary} />
                            </View>
                            <Text style={styles.paymentTitle}>Pagamento Pendente</Text>
                            <Text style={styles.paymentSub}>Aguardando o motorista confirmar o recebimento.</Text>

                            <View style={styles.finalFareBox}>
                                <Text style={styles.finalFareLabel}>Valor Total</Text>
                                <Text style={styles.finalFareValue}>Kz {currentFare.toLocaleString()}</Text>
                            </View>

                            <View style={styles.loadingSpinnerSmall}>
                                <Animated.View style={[styles.spinnerIcon, {
                                    transform: [{
                                        rotate: paymentAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0deg', '360deg']
                                        })
                                    }]
                                }]}>
                                    <Clock size={20} color={colors.primary} />
                                </Animated.View>
                                <Text style={styles.waitingText}>Processando...</Text>
                            </View>
                        </View>

                    </View>
                );

            case 'finished':
                return (
                    <View style={styles.overlay}>
                        <View style={styles.successIcon}>
                            <CheckCircle size={80} color={colors.success} />
                        </View>
                        <Text style={styles.overlayTitle}>Viagem Concluída!</Text>
                        <Text style={styles.overlaySub}>O valor final foi de Kz {currentFare.toLocaleString()}</Text>
                        <TouchableOpacity style={styles.primaryBtn} onPress={resetFlow}>
                            <Text style={styles.primaryBtnText}>Concluído</Text>
                        </TouchableOpacity>
                    </View>
                );

            default: return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <View style={styles.mapPlaceholder}>
                <HereMap 
                    ref={mapRef} 
                    onMapTap={onMapTap} 
                    onMapReady={() => setMapReady(true)} 
                />
                {(step === 'accepted' || step === 'ongoing') && <DriverLocationStatus updatedAt={driverLocationUpdatedAt} mapRef={mapRef} />}
            </View>
            {(step === 'home' || step === 'searching_address') && (
                <View style={styles.locationActions}>
                    <TouchableOpacity style={styles.locationActionBtn} disabled={locationLoading} onPress={() => locatePickup(true)}>
                        <Navigation size={16} color="#fff" />
                        <Text style={styles.primaryBtnText}>{locationLoading ? 'A localizar…' : 'Usar minha localização'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.locationActionSecondary} onPress={() => { mapTapRequestIdRef.current += 1; invalidateQuoteSelection(); locationRequestIdRef.current += 1; setLocationLoading(false); setSelectingPickup(true); }}>
                        <Text style={styles.locationActionSecondaryText}>{selectingPickup ? 'Toque no mapa para definir recolha' : 'Definir recolha no mapa'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Manual Sync Button - Only for restored sessions - Discreet floating button on the side */}
            {isRestored && (step === 'requesting' || step === 'accepted' || step === 'ongoing') && (
                <TouchableOpacity
                    style={styles.manualSyncBtn}
                    onPress={() => {
                        if (destination) {
                            mapRef.current?.setMarkers(pickupCoords, { lat: destination.lat, lng: destination.lng });
                            calculateFares(destination.lat, destination.lng);
                            console.log('🔄 [ManualSync] Forçando redesenho da rota.');
                        }
                    }}
                >
                    <Map size={20} color={colors.primary} />
                </TouchableOpacity>
            )}

            {renderOverlay()}
        </SafeAreaView>
    );
}

// STYLES FROM BACKUP (Condensed for brevity but keeping all key visual props)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    mapPlaceholder: { flex: 1, backgroundColor: '#F1F5F9' },
    bottomSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 30,
        ...colors.shadow,
    },
    sheetTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 20,
    },
    searchBar: {
        height: 60,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        marginBottom: 25,
    },
    searchBarActive: {
        borderColor: colors.primary,
        backgroundColor: '#FFF',
    },
    searchText: {
        marginLeft: 12,
        fontSize: 15,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    searchTextActive: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    destinationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
        marginRight: 12,
    },
    primaryBtn: {
        backgroundColor: '#FFF',
        width: '100%',
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: colors.primary
    },
    primaryBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
    },
    // Search Screen
    searchContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFF',
        zIndex: 100,
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    headerTitlePink: {
        fontSize: 16,
        fontWeight: '900',
        color: colors.primary,
        textTransform: 'uppercase',
    },
    inputsWrapper: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#FFF',
        paddingBottom: 25,
    },
    timelineContainer: {
        alignItems: 'center',
        marginRight: 15,
        paddingVertical: 12,
    },
    blueDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' },
    dottedLine: { flex: 1, width: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
    pinkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.primary },
    inputsColumn: { flex: 1 },
    inputBox: { height: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 4 },
    inputTextStatic: { fontSize: 15, fontWeight: '600', color: colors.text },
    inputDivider: { height: 1 },
    inputBoxActive: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FDF2F5',
        borderRadius: 8,
        paddingHorizontal: 10,
        marginTop: 4,
    },
    inputTextActive: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
    resultsList: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 10 },
    searchFeedback: { paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderRadius: 12, backgroundColor: '#F8FAFC' },
    searchFeedbackText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    searchRetryButton: { alignSelf: 'flex-start', paddingTop: 10, paddingBottom: 2 },
    searchRetryText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    resultIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FDF2F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    resultInfo: { flex: 1 },
    resultName: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 2 },
    resultAddress: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

    // Service Selection
    handleBar: {
        width: 40,
        height: 5,
        backgroundColor: '#E2E8F0',
        borderRadius: 2.5,
        alignSelf: 'center',
        marginBottom: 20,
    },
    sheetTitleCallback: {
        fontSize: 16,
        fontWeight: '900',
        color: colors.primary,
        textTransform: 'uppercase',
    },
    selectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    quoteFeedback: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
    },
    quoteFeedbackText: {
        marginTop: 8,
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    quoteRetryButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginTop: 6,
    },
    quoteRetryText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '800',
    },
    serviceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        marginBottom: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    serviceItemActive: {
        backgroundColor: '#FDF2F5',
        borderColor: colors.primary,
    },
    serviceLeft: { flexDirection: 'row', alignItems: 'center' },
    serviceIconBox: { marginRight: 15 },
    serviceName: { fontSize: 16, fontWeight: '900', color: colors.text },
    serviceCapacity: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    servicePrice: { fontSize: 18, fontWeight: '950', color: colors.text },

    // Overlays
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(233, 30, 99, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    radarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    radarRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    overlayTitle: {
        fontSize: 28,
        fontWeight: '950',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 10,
    },
    overlaySub: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        marginBottom: 40,
    },
    cancelText: {
        color: '#FFF',
        fontWeight: '800',
    },
    cancelBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },

    // Driver
    acceptedHeader: { alignItems: 'center', marginBottom: 20 },
    driverAvatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        ...colors.shadow,
    },
    avatarText: { fontSize: 32, fontWeight: '900', color: '#FFF' },
    acceptedTitle: { fontSize: 24, fontWeight: '950', color: colors.text, textAlign: 'center' },
    acceptedSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 5, fontWeight: '600' },
    actionButtons: { flexDirection: 'row', gap: 15, marginTop: 10 },
    actionBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },

    // Payment
    paymentCard: {
        backgroundColor: '#FFF',
        width: '100%',
        borderRadius: 32,
        padding: 30,
        alignItems: 'center',
        ...colors.shadow,
    },
    paymentIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FDF2F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    paymentTitle: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 10 },
    paymentSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', fontWeight: '600', lineHeight: 20, marginBottom: 25 },
    finalFareBox: {
        backgroundColor: '#F8FAFC',
        width: '100%',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 25,
    },
    finalFareLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
    finalFareValue: { fontSize: 30, fontWeight: '950', color: colors.text, marginTop: 5 },
    loadingSpinnerSmall: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    spinnerIcon: {},
    waitingText: { fontSize: 14, fontWeight: '800', color: colors.primary },
    successIcon: { marginBottom: 30 },

    // Ongoing Specific
    ongoingHeader: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
    },
    statusBadge: {
        backgroundColor: '#DCFCE7', // Brand Green Light
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    statusBadgeText: {
        color: '#166534', // Brand Green Dark
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ongoingPrice: {
        fontSize: 40,
        fontWeight: '900',
        color: colors.text,
        letterSpacing: -1.5,
        lineHeight: 48,
    },
    driverMinimalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 15,
        borderRadius: 20,
        marginBottom: 20,
    },
    driverAvatarSmall: {
        width: 44,
        height: 44,
        borderRadius: 18,
        backgroundColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarTextSmall: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.textSecondary,
    },
    driverMinimalDetails: {
        flex: 1,
        marginLeft: 12,
    },
    driverNameSmall: {
        fontSize: 15,
        fontWeight: '900',
        color: colors.text,
    },
    driverCarSmall: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
        marginTop: 2,
    },
    chatIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        ...colors.shadow,
    },
    progressPlaceholder: {
        marginBottom: 10,
    },
    progressBar: {
        height: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
    },
    etaBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 15,
        backgroundColor: '#FDF2F5',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        alignSelf: 'center',
    },
    etaText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    manualSyncBtn: {
        position: 'absolute',
        right: 15,
        top: '45%', // Side-aligned as requested
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        ...colors.shadow,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        zIndex: 10,
    },
    locationActions: { position: 'absolute', top: 108, alignSelf: 'center', zIndex: 1002, alignItems: 'center', gap: 8 },
    locationActionBtn: { minHeight: 44, borderRadius: 16, backgroundColor: colors.primary, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...colors.shadow },
    locationActionSecondary: { minHeight: 36, borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', ...colors.shadow },
    locationActionSecondaryText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
});
