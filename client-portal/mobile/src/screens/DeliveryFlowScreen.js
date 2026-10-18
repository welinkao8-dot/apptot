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
    Shield,
    CheckCircle,
    X,
    Heart,
    User,
    ArrowLeft,
    Smartphone,
    CreditCard
} from 'lucide-react-native';
import colors from '../theme/colors';
import socket, { setSocketToken } from '../services/socket';
import api from '../services/api';
import { toSafeErrorLog } from '../utils/safeErrorLog';
import hereService from '../services/hereService';
import HereMap from '../components/HereMap';
import { useAuth } from '../context/AuthContext';
import { isQuoteExpired, mergeQuotesWithServices } from '../utils/quoteSelection';
import Toast from 'react-native-toast-message';
import { drawSelectedQuoteRoute } from '../utils/quoteSelection';
import DriverLocationStatus from '../components/DriverLocationStatus';
import { formatCoordinateLabel, isValidCoordinate, validateTripLocations } from '../utils/tripLocation';
import { normalizeDeliveryInfo } from '../utils/deliveryInfo';

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

export default function DeliveryFlowScreen({ navigation, route }) {
    const { user, token } = useAuth();
    const [step, setStep] = useState('home'); // home -> searching_address -> delivery_details -> service_selection ...
    const [loading, setLoading] = useState(false);
    const [destination, setDestination] = useState(null);
    const [pickupAddress, setPickupAddress] = useState('A obter localização...');
    const [pickupCoords, setPickupCoords] = useState(route.params?.pickupCoords || null);
    const [selectedService, setSelectedService] = useState(null);
    const [availableServices, setAvailableServices] = useState([]);
    const [calculatedServices, setCalculatedServices] = useState([]);
    const [quotesLoading, setQuotesLoading] = useState(false);
    const [quoteError, setQuoteError] = useState(null);
    const [tripId, setTripId] = useState(null);
    const [acceptedDriver, setAcceptedDriver] = useState(null);
    const [driverLocationUpdatedAt, setDriverLocationUpdatedAt] = useState(null);
    const [currentFare, setCurrentFare] = useState(0);
    const [restoredRoutePolyline, setRestoredRoutePolyline] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchStatus, setSearchStatus] = useState('idle');
    const [searchAttempt, setSearchAttempt] = useState(0);
    const [selectingDestination, setSelectingDestination] = useState(false);
    const [deliveryInfo, setDeliveryInfo] = useState({
        recipientName: '',
        recipientPhone: '',
        packageDescription: ''
    });
    const [selectingPickup, setSelectingPickup] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);

    const [mapReady, setMapReady] = useState(false);
    const serviceSheetHeightRef = useRef(360);

    const mapRef = useRef(null);
    const tripIdRef = useRef(tripId);
    const setCurrentTripId = (id) => {
        tripIdRef.current = id;
        setTripId(id);
    };
    const radarAnim = useRef(new Animated.Value(0)).current;
    const quoteRequestIdRef = useRef(0);
    const quoteContextRef = useRef(null);
    const deliverySubmitRequestIdRef = useRef(0);
    const deliverySubmitInFlightRef = useRef(false);
    const searchRequestIdRef = useRef(0);
    const mapTapRequestIdRef = useRef(0);
    const locationRequestIdRef = useRef(0);
    const isMountedRef = useRef(false);
    const bootstrapRequestIdRef = useRef(0);

    const invalidateQuotes = () => {
        quoteRequestIdRef.current += 1;
        quoteContextRef.current = null;
        setCalculatedServices([]);
        setSelectedService(null);
        setQuotesLoading(false);
        setQuoteError(null);
        try {
            mapRef.current?.drawRoute?.(null);
        } catch (error) {
            console.warn('Could not clear the previous delivery route:', toSafeErrorLog(error));
        }
    };

    const updateDeliveryInfo = (field, value) => {
        invalidateQuotes();
        setDeliveryInfo(current => ({ ...current, [field]: value }));
    };

    const locatePickup = async (fromButton = false) => {
        const requestId = ++locationRequestIdRef.current;
        mapTapRequestIdRef.current += 1;
        setLocationLoading(true);
        try {
            const result = await getCurrentClientLocation();
            if (!isMountedRef.current || requestId !== locationRequestIdRef.current) return;
            if (result.status === 'granted') {
                invalidateQuotes();
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

    // --- Effects (Similar to RideFlow but specific for Delivery Persistence) ---

    const pickupCoordsRef = useRef(pickupCoords);
    const mapReadyRef = useRef(false);

    useEffect(() => {
        pickupCoordsRef.current = pickupCoords;
    }, [pickupCoords]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            quoteRequestIdRef.current += 1;
            deliverySubmitRequestIdRef.current += 1;
            deliverySubmitInFlightRef.current = false;
            searchRequestIdRef.current += 1;
            mapTapRequestIdRef.current += 1;
            locationRequestIdRef.current += 1;
        };
    }, []);

    useEffect(() => {
        const requestId = ++bootstrapRequestIdRef.current;
        void loadServices();

        const initialize = async () => {
            if (route.params?.tripId) {
                await hydrateFromTrip(route.params.tripId);
            } else if (route.params?.step === 'home') {
                console.log('✨ [DeliveryFlow] Iniciando novo pedido de entrega...');
                resetFlow();
            } else {
                const restored = await checkActiveDelivery();
                if (!restored && requestId === bootstrapRequestIdRef.current && !route.params?.pickupCoords) {
                    await locatePickup();
                }
            }

            setSocketToken(token);
            if (!socket.connected) socket.connect();
            else if (user) socket.emit('join');
        };
        void initialize();
        return () => { bootstrapRequestIdRef.current += 1; };
    }, [route.params?.tripId, route.params?.step, token]);

    const hydrateFromTrip = async (id) => {
        try {
            setLoading(true);
            const res = await api.get(`/trips/${id}`); // We'll need this endpoint or info from history
            const trip = res.data;
            if (trip && isMountedRef.current) {
                const origin = { lat: Number(trip.origin_lat), lng: Number(trip.origin_lng) };
                const destinationCoords = { lat: Number(trip.dest_lat), lng: Number(trip.dest_lng) };
                if (isValidCoordinate(origin)) {
                    setPickupCoords(origin);
                    pickupCoordsRef.current = origin;
                    setPickupAddress(trip.origin_address?.trim() || formatCoordinateLabel(origin));
                }
                setCurrentTripId(trip.id);
                setStep(trip.status === 'requested' ? 'requesting' :
                    trip.status === 'completed' ? 'waiting_payment' : trip.status);
                setDestination({
                    name: trip.dest_address?.split(',')[0],
                    address: trip.dest_address,
                    lat: destinationCoords.lat,
                    lng: destinationCoords.lng
                });
                setDeliveryInfo(trip.delivery_info && typeof trip.delivery_info === 'object' ? trip.delivery_info : {});
                const persistedRoute = trip.route_polyline
                    || trip.trip_quotes?.pricing_snapshot?.route?.polyline
                    || trip.trip_quotes?.pricing_snapshot?.routePolyline;
                setRestoredRoutePolyline(typeof persistedRoute === 'string' && persistedRoute.length > 0 ? persistedRoute : null);
                if (trip.profiles_trips_driver_idToprofiles) {
                    setAcceptedDriver({
                        id: trip.driver_id,
                        name: trip.profiles_trips_driver_idToprofiles.full_name,
                        lat: trip.driver_lat,
                        lng: trip.driver_lng
                    });
                }
                if (trip.current_fare || trip.estimated_fare || trip.final_fare) {
                    // Prioritize live fare (current_fare) over final/estimated - covers carousel restore case
                    setCurrentFare(Number(trip.current_fare || trip.final_fare || trip.estimated_fare));
                }
                // JOIN ROOM correctly with payload expected by server
                console.log(`📡 [DeliveryFlow] Entrando na sala do cliente: client_${user.id}`);
                socket.emit('join');
                return true;
            }
            return false;
        } catch (e) {
            console.error('Error hydrating trip:', toSafeErrorLog(e));
            return false;
        } finally {
            if (isMountedRef.current) setLoading(false);
        }
    };

    const checkActiveDelivery = async () => {
        if (!user?.id) return false;
        try {
            const res = await api.get(`/trips/active/${user.id}`);
            const activeData = res?.data;
            const activeTrips = Array.isArray(activeData) ? activeData : (activeData ? [activeData] : []);
            const delivery = activeTrips.find(trip => trip?.category === 'delivery'
                && ['requested', 'accepted', 'ongoing', 'completed'].includes(trip.status));
            if (delivery?.id) return await hydrateFromTrip(delivery.id);

            const currentTripId = tripIdRef.current;
            if (!currentTripId) return false;
            const persisted = (await api.get(`/trips/${currentTripId}`)).data;
            if (persisted?.status === 'completed' && persisted.trip_payment?.status === 'confirmed') {
                setCurrentTripId(persisted.id);
                const fare = Number(persisted.final_fare ?? persisted.estimated_fare ?? persisted.trip_payment.amount);
                if (Number.isFinite(fare)) setCurrentFare(fare);
                setStep('finished');
                return true;
            }
            if (persisted?.status === 'cancelled') resetFlow();
            return false;
        } catch (error) {
            console.warn('Could not restore active delivery:', toSafeErrorLog(error));
            return false;
        }
    };

    useEffect(() => {
        if (!mapReady || !tripId || !isValidCoordinate(pickupCoords) || !isValidCoordinate(destination)) return;
        mapRef.current?.setUserLocation(pickupCoords);
        mapRef.current?.setMarkers(pickupCoords, destination);
        if (restoredRoutePolyline) mapRef.current?.drawRoute(restoredRoutePolyline, getRouteFitPadding());
    }, [mapReady, tripId, pickupCoords?.lat, pickupCoords?.lng, destination?.lat, destination?.lng, restoredRoutePolyline]);

    useEffect(() => {
        const requestId = ++searchRequestIdRef.current;
        const delay = setTimeout(async () => {
            if (searchQuery.length >= 3) {
                setSearchStatus('loading');
                try {
                    const result = await hereService.fetchSuggestions(searchQuery, pickupCoordsRef.current);
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

    useEffect(() => {
        if (step === 'requesting') {
            Animated.loop(Animated.sequence([
                Animated.timing(radarAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
                Animated.timing(radarAnim, { toValue: 0, duration: 0, useNativeDriver: false })
            ])).start();
        } else { radarAnim.setValue(0); }
    }, [step]);

    useEffect(() => {
        const backAction = () => {
            if (step === 'home') {
                navigation.navigate('App', { screen: 'Dashboard' });
                return true;
            }
            if (['searching_address', 'delivery_details', 'service_selection'].includes(step)) {
                setStep('home');
                return true;
            }
            navigation.navigate('App', { screen: 'Dashboard' });
            return true;
        };
        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, [step]);

    // --- Socket Listeners (Stabilized) ---
    useEffect(() => {
        const onConnect = () => {
            socket.emit('join');
            void checkActiveDelivery();
        };
        const onTripCreated = (data) => {
            console.log('📦 [DeliveryFlow] Trip created:', data.tripId);
            setCurrentTripId(data.tripId);
            setStep('requesting');
            // Room join is usually handled in useEffect or upon login, but ensuring here
            socket.emit('join');
        };
        const onTripAccepted = (data) => { setAcceptedDriver(data.driver); setStep('accepted'); };
        const onRideStarted = () => setStep('ongoing');
        const onTripUpdate = (data) => {
            if (data.currentFare) setCurrentFare(data.currentFare);
            // Backend sends coords as { lat, lng } object inside data.coords
            const lat = data.coords?.lat ?? data.driverLat;
            const lng = data.coords?.lng ?? data.driverLng;
            if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
                setDriverLocationUpdatedAt(Number.isFinite(Number(data.timestamp)) ? Number(data.timestamp) : Date.now());
                mapRef.current?.setDriverPosition({ lat, lng });
            }
        };
        const onRideFinished = (data) => { setStep('waiting_payment'); setCurrentFare(data.finalFare); };
        const onPaymentConfirmed = () => setStep('finished');

        const onTripCancelled = () => {
            Toast.show({ type: 'error', text1: 'Cancelada', text2: 'A entrega foi cancelada.' });
            resetFlow();
        };

        const onTripTimeout = (data) => {
            Toast.show({ type: 'error', text1: 'Timeout', text2: data.message });
            resetFlow();
        };

        socket.on('connect', onConnect);
        socket.on('trip_created', onTripCreated);
        socket.on('trip_accepted', onTripAccepted);
        socket.on('ride_started', onRideStarted);
        socket.on('trip_update', onTripUpdate);
        socket.on('ride_finished', onRideFinished);
        socket.on('payment_confirmed', onPaymentConfirmed);
        socket.on('trip_cancelled', onTripCancelled);
        socket.on('trip_timeout', onTripTimeout);

        return () => {
            socket.off('connect', onConnect);
            socket.off('trip_created', onTripCreated);
            socket.off('trip_accepted', onTripAccepted);
            socket.off('ride_started', onRideStarted);
            socket.off('trip_update', onTripUpdate);
            socket.off('ride_finished', onRideFinished);
            socket.off('payment_confirmed', onPaymentConfirmed);
            socket.off('trip_cancelled', onTripCancelled);
            socket.off('trip_timeout', onTripTimeout);
        };
    }, []);

    const resetFlow = () => {
        mapTapRequestIdRef.current += 1;
        invalidateQuotes();
        deliverySubmitRequestIdRef.current += 1;
        deliverySubmitInFlightRef.current = false;
        setLoading(false);
        setDeliveryInfo({ recipientName: '', recipientPhone: '', packageDescription: '' });
        setStep('home');
        setCurrentTripId(null);
        setAcceptedDriver(null);
        setDriverLocationUpdatedAt(null);
        setDestination(null);
        setRestoredRoutePolyline(null);
        setCurrentFare(0);
        setSearchQuery('');
        if (mapRef.current) {
            mapRef.current.clearMap();
            if (pickupCoordsRef.current) mapRef.current.setUserLocation(pickupCoordsRef.current);
        }
    };

    // --- Helpers ---
    const loadServices = async () => {
        try { const res = await api.getServices(); setAvailableServices(res.data); } catch (e) { }
    };

    const calculateFares = async (destLat, destLng) => {
        invalidateQuotes();
        if (!pickupCoords) {
            setQuoteError('Ative a localização ou escolha o ponto de recolha no mapa.');
            Toast.show({ type: 'error', text1: 'Ponto de recolha necessário', text2: 'Ative a localização ou escolha o ponto de recolha no mapa.' });
            return;
        }
        const originLabel = pickupAddress?.trim() && pickupAddress !== 'A obter localização...'
            ? pickupAddress.trim()
            : `${pickupCoords.lat.toFixed(5)}, ${pickupCoords.lng.toFixed(5)}`;
        const destinationLabel = (destination?.address || destination?.name || '').trim()
            || `${destLat}, ${destLng}`;
        const locationValidation = validateTripLocations(pickupCoords, { lat: destLat, lng: destLng }, originLabel, destinationLabel);
        if (!locationValidation.valid) {
            quoteRequestIdRef.current += 1;
            setCalculatedServices([]);
            setSelectedService(null);
            setQuoteError(locationValidation.reason === 'same_location'
                ? 'A origem e o destino têm de ser diferentes.'
                : 'Confirme um ponto de recolha e um destino válidos no mapa.');
            return;
        }
        const deliveryValidation = normalizeDeliveryInfo(deliveryInfo);
        if (!deliveryValidation.valid) {
            quoteRequestIdRef.current += 1;
            setCalculatedServices([]);
            setSelectedService(null);
            setQuoteError(deliveryValidation.reason === 'phone'
                ? 'Informe um telefone angolano válido para o destinatário.'
                : 'Preencha o nome e uma descrição da encomenda (até 500 caracteres).');
            return;
        }
        mapRef.current?.setMarkers(pickupCoords, { lat: destLat, lng: destLng });
        const requestId = ++quoteRequestIdRef.current;
        const quoteContext = {
            pickupCoords: { lat: pickupCoords.lat, lng: pickupCoords.lng },
            destination: { lat: destLat, lng: destLng },
            deliveryInfo: deliveryValidation.value,
        };
        setQuotesLoading(true);
        setQuoteError(null);
        try {
            const response = await api.post('/quotes', {
                category: 'delivery',
                originAddress: originLabel,
                destAddress: destinationLabel,
                originLat: pickupCoords.lat,
                originLng: pickupCoords.lng,
                destLat,
                destLng,
                deliveryInfo: deliveryValidation.value,
            });
            if (requestId !== quoteRequestIdRef.current) return;
            const quotes = mergeQuotesWithServices(availableServices, response.data, 'delivery');
            const firstRoute = quotes.find(service => service.routePolyline)?.routePolyline;
            if (firstRoute) {
                // Reserve the area hidden by the vehicle sheet so both route ends stay visible.
                mapRef.current?.drawRoute(firstRoute, getRouteFitPadding());
            }
            if (quotes.length > 0) quoteContextRef.current = quoteContext;
            setCalculatedServices(quotes);
            if (quotes.length === 0) setQuoteError('Não há opções de entrega disponíveis para este percurso.');
        } catch (error) {
            if (requestId !== quoteRequestIdRef.current) return;
            setCalculatedServices([]);
            setQuoteError('Não foi possível calcular os preços. Verifique a ligação e tente novamente.');
        } finally {
            if (requestId === quoteRequestIdRef.current) setQuotesLoading(false);
        }
    };

    const handleSelectService = (service) => {
        if (!quoteContextRef.current) return;
        setSelectedService(service);
        drawSelectedQuoteRoute(service, mapRef.current, getRouteFitPadding());
    };

    const getRouteFitPadding = () => ({
        top: 80,
        bottom: serviceSheetHeightRef.current + 24,
        left: 48,
        right: 48,
    });

    const handleSelectDestination = (item) => {
        mapTapRequestIdRef.current += 1;
        invalidateQuotes();
        Keyboard.dismiss();
        setDestination(item);
        setSearchQuery(item.address || item.name);
        // After destination, go to DETAILS
        setStep('delivery_details');

        if (mapRef.current && pickupCoords) {
            const dest = { lat: item.lat, lng: item.lng };
            mapRef.current.setMarkers(pickupCoords, dest);
        }
    };

    const handleConfirmDetails = () => {
        const validation = normalizeDeliveryInfo(deliveryInfo);
        if (!validation.valid) {
            Toast.show({
                type: 'error',
                text1: validation.reason === 'phone' ? 'Telefone inválido' : 'Dados da entrega',
                text2: validation.reason === 'phone'
                    ? 'Informe um número angolano válido para o destinatário.'
                    : 'Preencha nome e descrição (máximo 500 caracteres).',
            });
            return;
        }
        setDeliveryInfo(validation.value);
        calculateFares(destination.lat, destination.lng);
        setStep('service_selection');
    };

    const handleRequestDelivery = async () => {
        if (deliverySubmitInFlightRef.current) return;
        if (!selectedService || !destination) return;

        const currentDeliveryInfo = normalizeDeliveryInfo(deliveryInfo);
        const quoteContext = quoteContextRef.current;
        if (!quoteContext
            || quoteContext.pickupCoords.lat !== pickupCoords?.lat
            || quoteContext.pickupCoords.lng !== pickupCoords?.lng
            || quoteContext.destination.lat !== destination.lat
            || quoteContext.destination.lng !== destination.lng
            || !currentDeliveryInfo.valid
            || JSON.stringify(quoteContext.deliveryInfo) !== JSON.stringify(currentDeliveryInfo.value)) {
            setSelectedService(null);
            Toast.show({ type: 'error', text1: 'Cotação desatualizada', text2: 'Confirme novamente os dados e recalcule o preço.' });
            return;
        }

        if (isQuoteExpired(selectedService)) {
            await calculateFares(destination.lat, destination.lng);
            setSelectedService(null);
            setStep('service_selection');
            Toast.show({ type: 'info', text1: 'Cotação atualizada', text2: 'Confira novamente o preço e selecione o serviço para confirmar.' });
            return;
        }

        if (!selectedService.quoteId) {
            Toast.show({ type: 'error', text1: 'Cotação indisponível', text2: 'Calcule novamente a rota antes de solicitar.' });
            return;
        }
        const payload = { quoteId: selectedService.quoteId };
        deliverySubmitInFlightRef.current = true;
        const requestId = ++deliverySubmitRequestIdRef.current;
        setLoading(true);
        const finishRequest = () => {
            if (requestId !== deliverySubmitRequestIdRef.current) return;
            deliverySubmitInFlightRef.current = false;
            setLoading(false);
        };
        try {
            socket.timeout(10000).emit('request_trip', payload, async (timeoutError, response) => {
                if (requestId !== deliverySubmitRequestIdRef.current) return;
                if (!timeoutError && response?.success && response.tripId) {
                    setCurrentTripId(response.tripId);
                    setStep('requesting');
                    finishRequest();
                    return;
                }
                try {
                    const active = await api.get(`/trips/active/${user.id}`);
                    if (requestId !== deliverySubmitRequestIdRef.current) return;
                    const committed = (Array.isArray(active.data) ? active.data : [active.data]).find((trip) => trip?.quote_id === payload.quoteId || trip?.id === response?.tripId);
                    if (committed) {
                        setCurrentTripId(committed.id);
                        setStep('requesting');
                    } else {
                        Toast.show({ type: 'error', text1: 'Pedido não confirmado', text2: response?.error || 'Verifique a ligação e tente novamente.' });
                    }
                } catch {
                    if (requestId !== deliverySubmitRequestIdRef.current) return;
                    Toast.show({ type: 'error', text1: 'Sem confirmação do servidor', text2: 'Verifique as suas entregas antes de tentar novamente.' });
                } finally {
                    finishRequest();
                }
            });
        } catch {
            finishRequest();
            Toast.show({ type: 'error', text1: 'Sem confirmação do servidor', text2: 'Verifique as suas entregas antes de tentar novamente.' });
        }
    };

    const onMapTap = async (coords) => {
        if (!['home', 'searching_address', 'selecting_map'].includes(step)) return;
        if (!isValidCoordinate(coords)) return;
        const requestId = ++mapTapRequestIdRef.current;
        const wasSelectingPickup = selectingPickup;
        if (wasSelectingPickup) {
            locationRequestIdRef.current += 1;
            setLocationLoading(false);
        }
        let address = null;
        try {
            address = await hereService.reverseGeocode(coords.lat, coords.lng);
        } catch (error) {
            console.warn('Could not resolve tapped delivery address:', toSafeErrorLog(error));
        }
        if (!isMountedRef.current || requestId !== mapTapRequestIdRef.current) return;
        if (wasSelectingPickup) {
            invalidateQuotes();
            setPickupCoords(coords);
            pickupCoordsRef.current = coords;
            setPickupAddress(address || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
            setSelectingPickup(false);
            if (mapRef.current) mapRef.current.setUserLocation(coords);
            Keyboard.dismiss();
            setStep('home');
            return;
        }
        setSelectingDestination(false);
        handleSelectDestination({
            name: address ? address.split(',')[0] : formatCoordinateLabel(coords),
            address: address || formatCoordinateLabel(coords),
            lat: coords.lat,
            lng: coords.lng
        });
    };

    // --- Render ---
    const renderContent = () => {
        const addressSearchFeedback = normalizeSuggestionSearchResult(Object.assign([], { status: searchStatus }));
        switch (step) {
            case 'home':
            case 'searching_address':
                // Re-use search UI or simplified one? Reuse simpler for brevity but could copy full one if needed.
                // Using the full one from RideFlow logic for better UX
                return (
                    <View style={styles.searchContainer}>
                        <View style={styles.searchHeader}>
                            <TouchableOpacity onPress={() => navigation.navigate('App', { screen: 'Dashboard' })}><ArrowLeft size={24} color={colors.text} /></TouchableOpacity>
                            <Text style={styles.headerTitlePink}>NOVA ENTREGA</Text>
                            <View style={{ width: 24 }} />
                        </View>
                        <View style={styles.inputsWrapper}>
                            <View style={styles.inputBoxActive}>
                                <TextInput
                                    style={styles.inputTextActive}
                                    placeholder="Onde entregar?"
                                    value={searchQuery}
                                    onChangeText={handleSearchQueryChange}
                                    autoFocus
                                />
                                {searchQuery.length > 0 && <TouchableOpacity onPress={() => handleSearchQueryChange('')}><X size={18} color={colors.primary} /></TouchableOpacity>}
                            </View>
                            {!pickupCoords && (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    style={styles.pickupMapLink}
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        mapTapRequestIdRef.current += 1;
                                        invalidateQuotes();
                                        setSelectingPickup(true);
                                        setStep('selecting_map');
                                    }}
                                >
                                    <Text style={styles.pickupMapLinkText}>Definir recolha no mapa</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView keyboardShouldPersistTaps="handled" style={styles.resultsList}>
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
                                    <MapPin size={20} color={colors.primary} style={{ marginRight: 10 }} />
                                    <View><Text style={styles.resultName}>{item.name}</Text><Text style={styles.resultAddress}>{item.address}</Text></View>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity style={styles.resultItem} onPress={() => {
                                Keyboard.dismiss();
                                mapTapRequestIdRef.current += 1;
                                invalidateQuotes();
                                setSearchResults([]);
                                setSelectingDestination(true);
                                setStep('selecting_map');
                            }}>
                                <MapPin size={20} color={colors.primary} style={{ marginRight: 10 }} />
                                <Text style={styles.resultName}>Selecionar no mapa</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                );

            case 'selecting_map':
                return (
                    <View style={styles.mapPickSheet}>
                        <Text style={styles.sheetTitleCallback}>
                            {selectingPickup ? 'DEFINA O PONTO DE RECOLHA' : 'DEFINA O DESTINO'}
                        </Text>
                        <Text style={styles.mapPickHint}>Toque no mapa para escolher o local.</Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            style={styles.mapPickCancel}
                            onPress={() => {
                                Keyboard.dismiss();
                                mapTapRequestIdRef.current += 1;
                                invalidateQuotes();
                                setSelectingPickup(false);
                                setSelectingDestination(false);
                                setStep('home');
                            }}
                        >
                            <Text style={styles.mapPickCancelText}>Voltar à pesquisa</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'delivery_details':
                return (
                    <View style={styles.bottomSheet}>
                        <Text style={styles.sheetTitleCallback}>DETALHES DA ENTREGA</Text>
                        <Text style={styles.inputLabel}>Para quem enviamos?</Text>
                        <TextInput style={styles.deliveryInput} placeholder="Nome do Destinatário" value={deliveryInfo.recipientName} onChangeText={t => updateDeliveryInfo('recipientName', t)} />

                        <Text style={styles.inputLabel}>Telemóvel</Text>
                        <TextInput style={styles.deliveryInput} placeholder="9xx xxx xxx" keyboardType="phone-pad" value={deliveryInfo.recipientPhone} onChangeText={t => updateDeliveryInfo('recipientPhone', t)} />

                        <Text style={styles.inputLabel}>Conteúdo</Text>
                        <TextInput style={[styles.deliveryInput, { height: 60 }]} placeholder="O que é?" multiline value={deliveryInfo.packageDescription} onChangeText={t => updateDeliveryInfo('packageDescription', t)} />

                        <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmDetails}>
                            <Text style={styles.primaryBtnText}>Próximo</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'service_selection':
                return (
                    <View
                        style={styles.bottomSheet}
                        onLayout={(event) => { serviceSheetHeightRef.current = event.nativeEvent.layout.height; }}
                    >
                        <Text style={styles.sheetTitleCallback}>VEÍCULO</Text>
                        {quotesLoading && (
                            <View style={styles.quoteFeedback}>
                                <ActivityIndicator color={colors.primary} />
                                <Text style={styles.quoteFeedbackText}>A calcular rota e preços…</Text>
                            </View>
                        )}
                        {!!quoteError && !quotesLoading && (
                            <View style={styles.quoteFeedback}>
                                <Text style={styles.quoteErrorText}>{quoteError}</Text>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() => destination && calculateFares(destination.lat, destination.lng)}
                                    disabled={!destination}
                                >
                                    <Text style={styles.quoteRetryText}>Tentar novamente</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {calculatedServices.map(service => (
                            <TouchableOpacity key={service.id} style={[styles.serviceItem, selectedService?.id === service.id && styles.serviceItemActive]} onPress={() => handleSelectService(service)}>
                                <View><Text style={styles.serviceName}>{service.name}</Text><Text style={styles.detailSubValue}>{(service.distanceMeters / 1000).toFixed(1)} km · {service.estimatedTime} min</Text></View>
                                <Text style={styles.servicePrice}>{service.estimatedPrice.toLocaleString()} Kz</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={[styles.primaryBtn, (!selectedService || loading || quotesLoading) && styles.primaryBtnDisabled]} onPress={handleRequestDelivery} disabled={!selectedService || loading || quotesLoading}>
                            <Text style={styles.primaryBtnText}>{loading ? 'A confirmar pedido...' : 'Chamar Entregador'}</Text>
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
                            <Package size={40} color="#FFF" />
                        </View>
                        <Text style={styles.overlayTitle}>Procurando entregador...</Text>
                        <Text style={styles.overlaySub}>Estamos conectando sua encomenda ao melhor estafeta</Text>

                        <View style={styles.waitingActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                                socket.emit('cancel_trip', { tripId });
                                resetFlow();
                            }}>
                                <Text style={styles.cancelText}>Cancelar Pedido</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.cancelBtn, { backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 15 }]}
                                onPress={() => navigation.navigate('App', { screen: 'Dashboard' })}
                            >
                                <Text style={styles.cancelText}>Voltar ao Dashboard</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case 'accepted':
            case 'ongoing':
                return (
                    <View style={styles.trackingWrapper}>
                        {/* Header Row: Status + Elegant Price */}
                        <View style={styles.trackingHeaderRow}>
                            <View style={[styles.statusBadgeAccepted, { flex: 0 }]}>
                                <Text style={styles.statusBadgeTextAccepted}>
                                    {step === 'accepted' ? 'MOTORISTA A CAMINHO' : 'ENTREGA EM CURSO'}
                                </Text>
                            </View>
                            <View style={styles.elegantPricePill}>
                                <Text style={styles.pricePillText}>
                                    {(currentFare || selectedService?.estimatedPrice || 0).toLocaleString()} Kz
                                </Text>
                            </View>
                        </View>

                        <ScrollView
                            style={styles.trackingScrollArea}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 100 }}
                        >
                            {/* Driver & Vehicle Section */}
                            <View style={styles.premiumSection}>
                                <View style={styles.sectionHeader}>
                                    <View style={styles.driverAvatarLarge}>
                                        <Text style={styles.avatarText}>{acceptedDriver?.name?.[0] || 'D'}</Text>
                                    </View>
                                    <View style={styles.driverCoreInfo}>
                                        <Text style={styles.cardDriverName}>{acceptedDriver?.name || 'Carregando...'}</Text>
                                        <Text style={styles.driverVehicleText}>Veículo não informado</Text>
                                    </View>
                                    <View style={styles.actionGroup}>
                                        <TouchableOpacity style={styles.actionCircleBtn}>
                                            <Smartphone size={18} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Delivery & Package Details */}
                            <View style={styles.premiumSection}>
                                <View style={styles.detailRow}>
                                    <View style={styles.iconBoxPink}><Package size={18} color={colors.primary} /></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.detailLabel}>O QUE ENVIAMOS</Text>
                                        <Text style={styles.detailValue}>{deliveryInfo.packageDescription}</Text>
                                    </View>
                                </View>

                                <View style={styles.sectionDivider} />

                                <View style={styles.detailRow}>
                                    <View style={styles.iconBoxPink}><User size={18} color={colors.primary} /></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.detailLabel}>DESTINATÁRIO</Text>
                                        <Text style={styles.detailValue}>{deliveryInfo.recipientName}</Text>
                                        <Text style={styles.detailSubValue}>{deliveryInfo.recipientPhone}</Text>
                                    </View>
                                </View>

                                <View style={styles.sectionDivider} />

                                <View style={styles.detailRow}>
                                    <View style={styles.iconBoxPink}><MapPin size={18} color={colors.primary} /></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.detailLabel}>DESTINO FINAL</Text>
                                        <Text style={styles.detailValue}>{destination?.name}</Text>
                                        <Text style={styles.detailSubValue}>{destination?.address}</Text>
                                    </View>
                                </View>
                            </View>
                        </ScrollView>

                        {/* Fixed Footer Ribbon */}
                        <TouchableOpacity
                            style={styles.fixedRibbonBtn}
                            onPress={() => navigation.navigate('Dashboard')}
                        >
                            <Text style={styles.fixedRibbonText}>Voltar ao Dashboard</Text>
                        </TouchableOpacity>
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
                            <Text style={styles.paymentSub}>Aguardando o entregador confirmar o recebimento.</Text>

                            <View style={styles.finalFareBox}>
                                <Text style={styles.finalFareLabel}>Valor Total</Text>
                                <Text style={styles.finalFareValue}>Kz {currentFare.toLocaleString()}</Text>
                            </View>

                            <View style={styles.waitingActionsOverlay}>
                                <TouchableOpacity
                                    style={styles.cancelBtnOverlay}
                                    onPress={() => navigation.navigate('App', { screen: 'Dashboard' })}
                                >
                                    <Text style={styles.cancelTextOverlay}>Voltar ao Dashboard</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );

            case 'finished':
                return (
                    <View style={styles.overlay}>
                        <View style={styles.successIconBox}>
                            <CheckCircle size={80} color="#10B981" />
                        </View>
                        <Text style={styles.overlayTitle}>Entrega Concluída!</Text>
                        <Text style={styles.overlaySub}>O valor final foi de Kz {currentFare.toLocaleString()}</Text>
                        <TouchableOpacity style={styles.primaryBtnLarge} onPress={resetFlow}>
                            <Text style={styles.primaryBtnTextLarge}>Concluído</Text>
                        </TouchableOpacity>
                    </View>
                );
            default: return null;
        }
    };

    const isTracking = step === 'accepted' || step === 'ongoing';
    const isOverlay = step === 'requesting' || step === 'waiting_payment' || step === 'finished';

    return (
        <SafeAreaView style={styles.container}>
            <View style={[
                styles.mapContainer,
                isTracking && styles.mapContainerSmall
            ]}>
                <HereMap
                    ref={mapRef}
                    onMapTap={onMapTap}
                    onMapReady={() => {
                        console.log('🗺️ [DeliveryFlow] Mapa pronto.');
                        setMapReady(true);
                        mapReadyRef.current = true;
                    }}
                />
                {(step === 'accepted' || step === 'ongoing') && <DriverLocationStatus updatedAt={driverLocationUpdatedAt} mapRef={mapRef} />}
                {(step === 'home' || step === 'searching_address') && (
                    <View style={styles.locationActions}>
                        <TouchableOpacity style={styles.locationActionBtn} disabled={locationLoading} onPress={() => locatePickup(true)}>
                            <Navigation size={16} color="#fff" />
                            <Text style={styles.primaryBtnText}>{locationLoading ? 'A localizar…' : 'Usar minha localização'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.locationActionSecondary} onPress={() => { mapTapRequestIdRef.current += 1; invalidateQuotes(); locationRequestIdRef.current += 1; setLocationLoading(false); setSelectingPickup(true); }}>
                            <Text style={styles.locationActionSecondaryText}>{selectingPickup ? 'Toque no mapa para definir recolha' : 'Definir recolha no mapa'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Sidebar Menu Icon - ONLY in tracking states, hide in Overlays */}
                {isTracking && !isOverlay && (
                    <TouchableOpacity
                        style={styles.menuIconButton}
                        onPress={() => navigation.openDrawer()}
                    >
                        <Menu size={24} color={colors.text} />
                    </TouchableOpacity>
                )}

                {/* Manual Sync Button (Fallback) */}
                {tripId && (
                    <TouchableOpacity
                        style={styles.syncButton}
                        onPress={() => {
                            if (destination) {
                                mapRef.current?.setMarkers(pickupCoordsRef.current, destination);
                                calculateFares(destination.lat, destination.lng);
                            }
                        }}
                    >
                        <Navigation size={20} color={colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {isTracking ? (
                <View style={styles.contentAreaLarge}>
                    {renderContent()}
                </View>
            ) : (
                renderContent()
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    mapPlaceholder: { flex: 1 },
    bottomSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 30,
        ...colors.shadow,
        position: 'absolute', bottom: 0, width: '100%'
    },
    sheetTitleCallback: { fontSize: 18, fontWeight: '900', color: colors.primary, marginBottom: 15, textTransform: 'uppercase' },
    inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 5, marginTop: 10 },
    deliveryInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 15, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: '#E2E8F0' },
    primaryBtn: { backgroundColor: colors.primary, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    primaryBtnDisabled: { opacity: 0.55 },
    primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
    quoteFeedback: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    quoteFeedbackText: { color: colors.textSecondary, fontSize: 13, flex: 1 },
    quoteErrorText: { color: '#B91C1C', fontSize: 13, flex: 1 },
    quoteRetryText: { color: colors.primary, fontSize: 13, fontWeight: '800', paddingVertical: 8 },
    mapPickSheet: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 24,
        zIndex: 1001,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        ...colors.shadow,
    },
    mapPickHint: { color: colors.textSecondary, fontSize: 14, marginBottom: 12 },
    mapPickCancel: { alignSelf: 'flex-start', paddingVertical: 8 },
    mapPickCancelText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
    locationActions: { position: 'absolute', top: 108, alignSelf: 'center', zIndex: 1002, alignItems: 'center', gap: 8 },
    locationActionBtn: { minHeight: 44, borderRadius: 16, backgroundColor: colors.primary, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...colors.shadow },
    locationActionSecondary: { minHeight: 36, borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', ...colors.shadow },
    locationActionSecondaryText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
    // Search
    searchContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFF' },
    searchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
    headerTitlePink: { fontSize: 16, fontWeight: '900', color: colors.primary },
    inputsWrapper: { paddingHorizontal: 20 },
    inputBoxActive: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDF2F5', padding: 10, borderRadius: 10 },
    inputTextActive: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '600' },
    resultsList: { padding: 20 },
    searchFeedback: { paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderRadius: 12, backgroundColor: '#F8FAFC' },
    searchFeedbackText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    searchRetryButton: { alignSelf: 'flex-start', paddingTop: 10, paddingBottom: 2 },
    searchRetryText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
    resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    resultName: { fontSize: 16, fontWeight: '700', color: colors.text },
    resultAddress: { fontSize: 13, color: colors.textSecondary },
    // Service
    serviceItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderRadius: 15, backgroundColor: '#F8FAFC', marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
    serviceItemActive: { backgroundColor: '#FDF2F5', borderColor: colors.primary },
    serviceName: { fontSize: 16, fontWeight: '800', color: colors.text },
    servicePrice: { fontSize: 16, fontWeight: '900', color: colors.text },
    acceptedTitle: { fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center', marginVertical: 20 },
    driverName: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
    syncButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        ...colors.shadow
    },

    // Overlay styles for requesting mode
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(236, 17, 107, 0.95)', // Premium Pink Overlay
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        zIndex: 1000
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
        fontSize: 26,
        fontWeight: '950',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 10,
    },
    overlaySub: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        marginBottom: 40,
        fontWeight: '600'
    },
    waitingActions: { width: '100%', alignItems: 'center' },
    cancelBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        width: '80%',
        alignItems: 'center'
    },
    cancelText: {
        color: '#FFF',
        fontWeight: '900',
        fontSize: 15
    },

    // --- New Redesign Styles ---
    mapContainer: { flex: 1 },
    mapContainerSmall: { flex: 0.3 },
    contentArea: { position: 'absolute', bottom: 0, width: '100%', zIndex: 10 },
    contentAreaLarge: {
        position: 'relative',
        flex: 0.7,
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        ...colors.shadow,
        shadowOpacity: 0.012, // 50% reduction from previous value
        elevation: 2
    },
    menuIconButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
        ...colors.shadow
    },
    trackingScroll: { padding: 25 },
    trackingHeader: { alignItems: 'center', marginBottom: 25 },
    trackingTitle: { fontSize: 24, fontWeight: '950', color: colors.text, marginTop: 10 },
    statusBadgeAccepted: { backgroundColor: '#FDF2F5', paddingVertical: 6, paddingHorizontal: 15, borderRadius: 12 },
    statusBadgeTextAccepted: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    statusBadgeOngoing: { backgroundColor: '#FDF2F5', paddingVertical: 6, paddingHorizontal: 15, borderRadius: 12 },
    statusBadgeTextOngoing: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    premiumCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 15,
        ...colors.shadow,
        shadowOpacity: 0.025, // 75% reduction
        elevation: 2
    },
    solidPinkCard: {
        backgroundColor: colors.primary,
    },
    priceLabelWhite: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.8)', marginBottom: 5 },
    priceValueWhite: { fontSize: 36, fontWeight: '950', color: '#FFF' },
    fullWidthBackBtn: {
        backgroundColor: colors.primary,
        width: width, // Full width
        marginLeft: -25, // Compensation for trackingScroll padding
        height: 45, // Reduced height
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    fullWidthBackBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    driverAvatarLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 28, fontWeight: '900', color: '#FFF' },
    driverCoreInfo: { flex: 1, marginLeft: 15 },
    cardDriverName: { fontSize: 18, fontWeight: '900', color: colors.text },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    ratingText: { marginLeft: 5, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    chatActionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    cardSection: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    cardLabel: { fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    cardValue: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
    cardSubValue: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    cardDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 5 },
    priceLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, marginBottom: 5 },
    priceValue: { fontSize: 36, fontWeight: '950', color: colors.primary },
    driverMinimalRow: { flexDirection: 'row', alignItems: 'center' },
    driverAvatarSmall: { width: 44, height: 44, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    avatarTextSmall: { fontSize: 18, fontWeight: '900', color: colors.textSecondary },
    smallDriverName: { fontSize: 16, fontWeight: '800', color: colors.text },
    smallDriverCar: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    smallChatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FDF2F5', justifyContent: 'center', alignItems: 'center' },

    // --- Elegant Redesign (Huber Style) ---
    trackingWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
    trackingHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingVertical: 20,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    elegantPricePill: {
        backgroundColor: colors.primary,
        paddingHorizontal: 15,
        paddingVertical: 6,
        borderRadius: 20,
        ...colors.shadow,
        shadowOpacity: 0.025, // Reduced by 50%
    },
    pricePillText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
    },
    trackingScrollArea: { flex: 1 },
    premiumSection: {
        backgroundColor: '#FFF',
        marginHorizontal: 20,
        marginTop: 15,
        borderRadius: 24,
        padding: 20,
        ...colors.shadow,
        shadowOpacity: 0.01, // Reduced by 50%
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center' },
    driverVehicleText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
    actionGroup: { flexDirection: 'row', gap: 10 },
    actionCircleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 5 },
    iconBoxPink: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#FDF2F5',
        justifyContent: 'center',
        alignItems: 'center'
    },
    detailLabel: { fontSize: 9, fontWeight: '900', color: colors.textMuted, letterSpacing: 1 },
    detailValue: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 },
    detailSubValue: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    sectionDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
    fixedRibbonBtn: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: colors.primary,
        height: 55,
        justifyContent: 'center',
        alignItems: 'center',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
    },
    fixedRibbonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '950',
        textTransform: 'uppercase',
        letterSpacing: 2
    },
    priceValueLarge: { fontSize: 42, fontWeight: '950', color: colors.primary, marginTop: 10 },
    priceSubtext: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginTop: 5, textAlign: 'center' },
    paymentCard: {
        backgroundColor: '#FFF',
        width: '90%',
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
    finalFareLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 5 },
    finalFareValue: { fontSize: 32, fontWeight: '950', color: colors.primary },
    successIconBox: { marginBottom: 20 },
    primaryBtnLarge: {
        backgroundColor: colors.primary,
        width: '100%',
        height: 55,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryBtnTextLarge: { color: '#FFF', fontSize: 18, fontWeight: '800' },
    waitingActionsOverlay: { width: '100%', marginTop: 5 },
    cancelBtnOverlay: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingVertical: 15,
        borderRadius: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)'
    },
    cancelTextOverlay: { color: colors.text, fontWeight: '800', fontSize: 14 }
});
