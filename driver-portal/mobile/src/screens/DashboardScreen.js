import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Platform, DeviceEventEmitter, AppState,
    PermissionsAndroid, StatusBar, Dimensions, Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openNavigationApp } from '../utils/openNavigation';
import { AuthContext } from '../context/AuthContext';
import { connectSocket, disconnectSocket } from '../services/socket';
import colors from '../theme/colors';
import api from '../services/api';
import Toast from 'react-native-toast-message';
import { NativeModules } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import messaging from '@react-native-firebase/messaging';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, interpolate } from 'react-native-reanimated';

import { User, Power, Info } from 'lucide-react-native';

import GoingToClientView from '../components/ride/GoingToClientView';
import OngoingRideView from '../components/ride/OngoingRideView';
import AwaitingPaymentView from '../components/ride/AwaitingPaymentView';
import { formatCurrency } from '../utils/formatters';
import { emitSocketCommand } from '../services/socketCommands';
import { requestDriverAvailability, restoreDriverAvailability } from '../services/driverAvailability';
import { toSafeErrorLog } from '../utils/safeErrorLog';
import { getTripFare } from '../utils/tripFare';
import { startAndWaitForLocationFix as waitForGpsFix } from '../services/driverLocation';
import { acceptRideWithReconciliation } from '../services/rideAcceptance';
import { runRideTransitionWithReconciliation } from '../services/rideTransition';
import { reconcileActiveRide } from '../services/rideReconciliation';
import { isTripOfferMessage, openPendingTripOffer, registerDriverPushToken } from '../services/driverPushNotifications';

const { LocationModule } = NativeModules;
const { width } = Dimensions.get('window');
const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

export default function DashboardScreen({ navigation }) {
    const { user, token } = useContext(AuthContext);
    const [isOnline, setIsOnline] = useState(false);
    const [stats, setStats] = useState({ rides: 0, earnings: 0 });
    const [requests, setRequests] = useState([]);
    const [rideStatus, setRideStatus] = useState('idle');
    const [activeTrip, setActiveTrip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOnlineUpdating, setIsOnlineUpdating] = useState(false);
    const [isPaymentUpdating, setIsPaymentUpdating] = useState(false);
    const socket = useRef(null);
    const notifiedOfferIds = useRef(new Set());
    const activeTripRef = useRef(activeTrip);
    const reconcilingTrip = useRef(null);
    const reconciliationGeneration = useRef(0);
    const invalidateRideReconciliation = () => {
        reconciliationGeneration.current += 1;
        reconcilingTrip.current = null;
    };

    useEffect(() => { activeTripRef.current = activeTrip; }, [activeTrip]);

    useEffect(() => () => {
        reconciliationGeneration.current += 1;
        reconcilingTrip.current = null;
    }, []);

    // Carousel states
    const [currentSlide, setCurrentSlide] = useState(0);
    const carouselRef = useRef(null);

    // Pulse animation for status pill
    const pulseAnim = useSharedValue(1);
    useEffect(() => {
        if (isOnline) {
            pulseAnim.value = withRepeat(
                withSequence(withTiming(1.2, { duration: 1000 }), withTiming(1, { duration: 1000 })),
                -1, false
            );
        } else {
            pulseAnim.value = withTiming(1, { duration: 200 });
        }
    }, [isOnline]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
        opacity: interpolate(pulseAnim.value, [1, 1.2], [0.8, 0.4]),
    }));

    // Slide auto-play
    useEffect(() => {
        const slideTimer = setInterval(() => {
            setCurrentSlide(prev => {
                const next = prev === 0 ? 1 : 0;
                carouselRef.current?.scrollTo({ x: next * (width - 40), animated: true });
                return next;
            });
        }, 4000);
        return () => clearInterval(slideTimer);
    }, []);

    useEffect(() => {
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!token || !user) {
            disconnectSocket();
            socket.current = null;
            return undefined;
        }

        socket.current = connectSocket(token);
        const removeSocketListeners = setupSocketListeners();
        fetchStats();
        return () => removeSocketListeners?.();
    }, [token, user?.id]);

    const setupSocketListeners = () => {
        if (!socket.current || !user) return;
        const currentSocket = socket.current;
        const handlers = {
        connect: () => {
            if (user?.id) currentSocket.emit('join');
            if (activeTripRef.current) refreshActiveRide(activeTripRef.current);
        },
        login_status: async (data) => {
            const result = await restoreDriverAvailability({
                socket: currentSocket,
                locationModule: LocationModule,
                platform: Platform.OS,
                isOnline: data?.isOnline === true,
                hasLocationPermission: hasExistingLocationPermission,
                ensureBackgroundLocationAuthorization: () => LocationModule?.ensureBackgroundLocationAuthorization?.(),
                startAndWaitForLocationFix: () => waitForGpsFix({ locationModule: LocationModule, eventEmitter: DeviceEventEmitter }),
            });
            setIsOnline(result.serverOnline);
            await AsyncStorage.setItem('@tot_is_online', result.serverOnline.toString());
            if (result.serverOnline) fetchPendingTrips();
            else setRequests([]);
            if (result.syncFailed) {
                Toast.show({ type: 'error', text1: 'Localização indisponível', text2: 'O servidor ainda considera a conta online. Desative a disponibilidade quando recuperar a ligação.' });
            }
        },
        new_trip_available: (trip) => {
            if (!notifiedOfferIds.current.has(trip.id)) {
                notifiedOfferIds.current.add(trip.id);
                ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
                Toast.show({ type: 'info', text1: 'Nova solicitação', text2: 'Uma oferta foi adicionada à lista.' });
            }
            setRequests(prev => prev.some(r => r.id === trip.id) ? prev : [trip, ...prev]);
        },
        trip_taken: (data) => {
            notifiedOfferIds.current.delete(data.tripId);
            setRequests(prev => prev.filter(r => r.id !== data.tripId));
        },
        restore_ride: (trip) => {
            const restoredStatus = trip.status === 'completed' ? 'finished' : (trip.status || 'ongoing');
            invalidateRideReconciliation();
            setActiveTrip(trip); setRideStatus(restoredStatus);
            activeTripRef.current = trip;
            AsyncStorage.setItem('@tot_active_trip', JSON.stringify(trip));
            AsyncStorage.setItem('@tot_ride_status', restoredStatus);
            refreshActiveRide(trip);
        },
        trip_cancelled: () => { Toast.show({ type: 'error', text1: 'Corrida cancelada.' }); resetRide(); },
        pending_trips: (trips) => { if (Array.isArray(trips)) setRequests(trips); },
        };

        Object.entries(handlers).forEach(([event, handler]) => currentSocket.on(event, handler));
        return () => Object.entries(handlers).forEach(([event, handler]) => currentSocket.off(event, handler));
    };

    const fetchStats = async () => { 
        if (!user) return; 
        try { 
            const r = await api.get(`/trips/stats/${user.id}`); 
            if (r.data) {
                setStats({
                    rides: r.data.count || 0,
                    earnings: r.data.totalFare || 0
                });
            }
        } catch (e) {
            console.error('Error fetching dashboard stats:', toSafeErrorLog(e));
        } 
    };
    const fetchPendingTrips = async () => { try { const r = await api.get('/trips/pending'); if (r.data) setRequests(r.data); return r.data; } catch (e) { return []; } };

    useEffect(() => {
        if (!token || Platform.OS !== 'android') return undefined;

        const handlePushMessage = async (message, shouldOpenOffer = false) => {
            const tripId = isTripOfferMessage(message);
            if (!tripId) return;
            if (!notifiedOfferIds.current.has(tripId)) {
                notifiedOfferIds.current.add(tripId);
                ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
                Toast.show({ type: 'info', text1: 'Nova solicitação', text2: shouldOpenOffer ? 'A verificar se a oferta ainda está disponível.' : 'Abre a lista para ver a oferta.' });
            }
            if (shouldOpenOffer) {
                const trip = await openPendingTripOffer({
                    tripId,
                    api,
                    navigation,
                    onAccept: (offer) => handleAcceptRide(offer),
                    onReject: (offer) => handleDeclineRide(offer),
                });
                if (trip) {
                    setRequests((current) => current.some((item) => item.id === trip.id) ? current : [trip, ...current]);
                } else {
                    await fetchPendingTrips();
                    Toast.show({ type: 'info', text1: 'Oferta indisponível', text2: 'A solicitação expirou ou já foi aceite.' });
                }
                return;
            }
            await fetchPendingTrips();
        };

        const instance = messaging();
        const unsubscribeForeground = instance.onMessage(handlePushMessage);
        const unsubscribeOpened = instance.onNotificationOpenedApp((message) => handlePushMessage(message, true));
        instance.getInitialNotification().then((message) => handlePushMessage(message, true)).catch(() => {});
        return () => {
            unsubscribeForeground();
            unsubscribeOpened();
        };
    }, [token]);

    const refreshActiveRide = useCallback(async (trip = activeTripRef.current) => {
        if (!trip?.id || !user?.id || reconcilingTrip.current?.tripId === trip.id) return;
        const request = { tripId: trip.id, generation: ++reconciliationGeneration.current };
        reconcilingTrip.current = request;
        try {
            const result = await reconcileActiveRide({
                cachedTrip: trip,
                driverId: user.id,
                fetchTrip: async (tripId) => (await api.get(`/trips/${tripId}`)).data,
                fetchPayment: async (tripId) => {
                    try {
                        return (await api.get(`/trips/${tripId}/payment`)).data;
                    } catch (error) {
                        if (error.response?.status === 404) return null;
                        throw error;
                    }
                },
            });
            if (request.generation !== reconciliationGeneration.current) return;
            if (activeTripRef.current?.id && activeTripRef.current.id !== trip.id) return;
            if (result.clear) {
                invalidateRideReconciliation();
                activeTripRef.current = null;
                setActiveTrip(null);
                setRideStatus('idle');
                await AsyncStorage.removeItem('@tot_active_trip');
                await AsyncStorage.removeItem('@tot_ride_status');
                return;
            }
            activeTripRef.current = result.trip;
            setActiveTrip(result.trip);
            setRideStatus(result.status);
            await AsyncStorage.setItem('@tot_active_trip', JSON.stringify(result.trip));
            await AsyncStorage.setItem('@tot_ride_status', result.status);
        } catch (error) {
            console.warn('Trip state sync failed:', toSafeErrorLog(error));
        } finally {
            if (reconcilingTrip.current === request) reconcilingTrip.current = null;
        }
    }, [user?.id]);

    useEffect(() => {
        const refresh = () => {
            if (isOnline) fetchPendingTrips();
            if (activeTripRef.current) refreshActiveRide(activeTripRef.current);
        };
        const focus = navigation.addListener('focus', refresh);
        const appState = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                refresh();
            }
        });
        const expiry = setInterval(() => setRequests((current) => current.filter((offer) => !offer.offerExpiresAt || Date.parse(offer.offerExpiresAt) > Date.now())), 3000);
        return () => { focus(); appState.remove(); clearInterval(expiry); };
    }, [isOnline, navigation, refreshActiveRide, user?.id]);

    const checkPermissions = async () => {
        if (Platform.OS !== 'android') return true;
        const perms = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
        if (Platform.Version >= 33) perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        const g = await PermissionsAndroid.requestMultiple(perms);
        if (Platform.Version >= 33 && g['android.permission.POST_NOTIFICATIONS'] !== PermissionsAndroid.RESULTS.GRANTED) {
            throw Object.assign(new Error('Permissão de notificações necessária para receber novas ofertas.'), { code: 'NOTIFICATION_PERMISSION_DENIED' });
        }
        const hasLocation = g['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;
        if (!hasLocation) return false;
        const pushToken = await messaging().getToken();
        await registerDriverPushToken({ token: pushToken, platform: 'android', api });
        return true;
    };

    const hasExistingLocationPermission = async () => {
        if (Platform.OS !== 'android') return true;
        return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    };

    const toggleOnline = async () => {
        if (!user || isOnlineUpdating) return;
        const next = !isOnline;
        setIsOnlineUpdating(true);
        try {
            await requestDriverAvailability({
                socket: socket.current,
                locationModule: LocationModule,
                platform: Platform.OS,
                isOnline: next,
                hasLocationPermission: checkPermissions,
                ensureBackgroundLocationAuthorization: () => LocationModule?.ensureBackgroundLocationAuthorization?.(),
                startAndWaitForLocationFix: () => waitForGpsFix({ locationModule: LocationModule, eventEmitter: DeviceEventEmitter }),
            });
            setIsOnline(next);
            await AsyncStorage.setItem('@tot_is_online', next.toString());
            ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
            if (!next) setRequests([]); else fetchPendingTrips();
        } catch (error) {
            const message = error.code === 'NOTIFICATION_PERMISSION_DENIED'
                ? 'Permita as notificações para ficar disponível para corridas.'
                : error.code === 'PUSH_TOKEN_UNAVAILABLE'
                    ? 'Não foi possível ativar notificações neste telemóvel.'
                : error.code === 'LOCATION_PERMISSION_DENIED'
                ? 'Permissão de localização necessária.'
                : error.code === 'LOCATION_BACKGROUND_PERMISSION_DENIED'
                    ? 'Autorize localização “Sempre” para ficar disponível enquanto usa a navegação.'
                : error.code === 'LOCATION_FIX_TIMEOUT'
                    ? 'Não foi possível obter uma localização GPS válida.'
                : error.code?.startsWith('LOCATION_')
                    ? 'Não foi possível iniciar o serviço de localização.'
                    : 'Não foi possível alterar a disponibilidade';
            Toast.show({ type: 'error', text1: message, text2: 'Verifique a localização e a ligação e tente novamente.' });
        } finally { setIsOnlineUpdating(false); }
    };

    const handleAcceptRide = async (trip) => {
        if (!user) return;
        try {
            const result = await acceptRideWithReconciliation({
                trip,
                driverId: user.id,
                accept: () => emitSocketCommand(socket.current, 'accept_trip', { tripId: trip.id }),
                fetchTrip: async (tripId) => (await api.get(`/trips/${tripId}`)).data,
            });
            invalidateRideReconciliation();
            activeTripRef.current = result.trip;
            setActiveTrip(result.trip); setRideStatus(result.rideStatus); setRequests([]);
            await AsyncStorage.setItem('@tot_active_trip', JSON.stringify(result.trip));
            await AsyncStorage.setItem('@tot_ride_status', result.rideStatus);
            if (result.reconciled) Toast.show({ type: 'success', text1: 'Corrida aceite', text2: 'O estado foi recuperado do servidor.' });
        } catch { Toast.show({ type: 'error', text1: 'Corrida já não disponível', text2: 'Atualize a lista e tente outra solicitação.' }); }
    };

    const handleDeclineRide = async (trip) => {
        try {
            await emitSocketCommand(socket.current, 'decline_trip', { tripId: trip.id });
            notifiedOfferIds.current.delete(trip.id);
            setRequests((current) => current.filter((offer) => offer.id !== trip.id));
            Toast.show({ type: 'info', text1: 'Oferta recusada', text2: 'A solicitação foi retirada da sua lista.' });
        } catch {
            Toast.show({ type: 'error', text1: 'Não foi possível recusar', text2: 'Atualize a lista e tente novamente.' });
        }
    };

    const handleStartRide = async () => {
        if (!activeTrip) return;
        try {
            const result = await runRideTransitionWithReconciliation({
                trip: activeTrip,
                driverId: user?.id,
                targetStatus: 'ongoing',
                transition: () => emitSocketCommand(socket.current, 'start_ride', { tripId: activeTrip.id }),
                fetchTrip: async (tripId) => (await api.get(`/trips/${tripId}`)).data,
            });
            invalidateRideReconciliation();
            activeTripRef.current = result.trip;
            setActiveTrip(result.trip);
            setRideStatus(result.status);
            await AsyncStorage.setItem('@tot_active_trip', JSON.stringify(result.trip));
            await AsyncStorage.setItem('@tot_ride_status', result.status);
        }
        catch { Toast.show({ type: 'error', text1: 'Não foi possível iniciar a corrida', text2: 'Confirme a ligação e tente novamente.' }); }
    };

    const handleFinishRide = async () => {
        if (!activeTrip) return;
        try {
            const result = await runRideTransitionWithReconciliation({
                trip: activeTrip,
                driverId: user?.id,
                targetStatus: 'completed',
                transition: () => emitSocketCommand(socket.current, 'finish_ride', { tripId: activeTrip.id }),
                fetchTrip: async (tripId) => (await api.get(`/trips/${tripId}`)).data,
            });
            invalidateRideReconciliation();
            activeTripRef.current = result.trip;
            setActiveTrip(result.trip);
            setRideStatus('finished');
            await AsyncStorage.setItem('@tot_active_trip', JSON.stringify(result.trip));
            await AsyncStorage.setItem('@tot_ride_status', 'finished');
        } catch { Toast.show({ type: 'error', text1: 'Não foi possível concluir a corrida', text2: 'O estado será mantido até confirmação do servidor.' }); }
    };

    const handleConfirmPayment = async () => {
        if (!activeTrip || isPaymentUpdating) return;
        const fare = getTripFare(activeTrip, { requireFinalFare: true });
        if (fare === null) {
            Toast.show({ type: 'error', text1: 'Valor da viagem indisponível', text2: 'Sincronize a viagem com o servidor antes de confirmar o recebimento.' });
            return;
        }
        setIsPaymentUpdating(true);
        try {
            await emitSocketCommand(socket.current, 'confirm_cash_payment', { tripId: activeTrip.id, amount: fare.toFixed(2) });
            resetRide(); fetchStats();
        } catch (error) {
            if (error.code === 'ACK_TIMEOUT' || error.code === 'SOCKET_DISCONNECTED') {
                try {
                    const result = await api.get(`/trips/${activeTrip.id}/payment`);
                    if (result.data?.status === 'confirmed') { resetRide(); fetchStats(); return; }
                } catch { /* Keep the trip visible until server status can be checked. */ }
            }
            Toast.show({ type: 'error', text1: 'Pagamento ainda não confirmado', text2: 'Consulte novamente quando a ligação estiver disponível.' });
        } finally { setIsPaymentUpdating(false); }
    };

    const resetRide = () => {
        invalidateRideReconciliation();
        activeTripRef.current = null;
        setActiveTrip(null); setRideStatus('idle');
        AsyncStorage.removeItem('@tot_active_trip'); AsyncStorage.removeItem('@tot_ride_status');
    };

    if (isLoading) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;

    const openTripMap = async (point, label) => {
        const result = await openNavigationApp(point?.lat, point?.lng, label);
        if (!result.ok) Toast.show({ type: 'error', text1: result.reason === 'invalid_coordinates' ? 'Endereço sem coordenadas válidas' : 'Não foi possível abrir um mapa', text2: 'Verifique a ligação e as aplicações de mapas instaladas.' });
    };

    if (rideStatus === 'accepted') return <GoingToClientView user={user} activeTrip={activeTrip} onStartRide={handleStartRide} onOpenMap={() => openTripMap(activeTrip?.coords, 'Local de Recolha')} />;
    if (rideStatus === 'ongoing') return <OngoingRideView user={user} activeTrip={activeTrip} onFinishRide={handleFinishRide} onOpenMap={() => openTripMap(activeTrip?.destPos, 'Destino')} />;
    if (rideStatus === 'finished') return <AwaitingPaymentView user={user} activeTrip={activeTrip} onConfirmPayment={handleConfirmPayment} loading={isPaymentUpdating} />;

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

            {/* ─── TOP APP BAR ─── */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <View style={styles.avatarMiniBorder}>
                        {user?.avatar_url ? (
                            <Image source={{ uri: user.avatar_url }} style={styles.avatarMini} />
                        ) : (
                            <View style={styles.avatarMiniFallback}>
                                <Text style={styles.avatarMiniFallbackText}>
                                    {user?.full_name?.[0]?.toUpperCase() || 'M'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.logoText}>TOT</Text>
                </View>
            </View>

            {/* ─── MAIN CONTENT ─── */}
            <ScrollView style={styles.scrollCanvas} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* Daily Earnings Card */}
                <View style={styles.earningsCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.earningsLabel}>Ganhos de Hoje</Text>
                        <Text style={styles.earningsValue}>{formatCurrency(stats.earnings)}</Text>
                    </View>
                    <View style={styles.ridesInfo}>
                        <Text style={styles.earningsLabel}>Corridas</Text>
                        <Text style={styles.ridesValue}>{stats.rides}</Text>
                    </View>
                </View>

                {/* Advertising Slider (Carousel) */}
                <View style={styles.sliderWrapper}>
                    <ScrollView
                        ref={carouselRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        scrollEventThrottle={16}
                        onScroll={(e) => {
                            const index = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
                            setCurrentSlide(index);
                        }}
                        style={styles.sliderScroll}
                    >
                        <View style={styles.sliderItem}>
                            <Image source={{ uri: 'https://lh3.googleusercontent.com/aida/AP1WRLujdYRp3SrZiujUZ1c03tcvXOOZEqoMcJU6Ee3rY_RD6DutWlz5P4bgkjyfQtu3gby1A-dGeO7OTSzdjrYd8QPOwo8SFqbjmaHA4WdTD06bH1SggE18LliKdsRkLO8k4iMPIobSvAZh0DvHPplNRe5LiMV1UGzvRzuHZ3ePjteH_DGACaoP7w_9eiXeq7P7DJJBYJWtCQL6k3zjAs7gvKbYcB-0-vdJnS2KT469z2IWmga3EKvwNruYj_2z' }} style={styles.sliderImg} />
                        </View>
                        <View style={styles.sliderItem}>
                            <Image source={{ uri: 'https://lh3.googleusercontent.com/aida/AP1WRLvxWGZKHa_xc1cUfvQVde2oqcwriPbctgBH6S44mCywNGzknmbgmqDJzH9Xb8f1YXbU8m2qYI9RYY3eurZMIUVcwqPgL7-w8S0GgCrxZxdQiPNVbkKa1Nyzb-AOUAxEpue_JTnLGrkeErOzNPagr7egYsVFxV5TYYjmx7Z5OAdG2ogSO9lFixSlhdur24uLBAoLgX5HboqZOCO67IU9nGZ7eLKuwxpZ0uGKUoz39EkR3xyINI9xdWfS8lKM' }} style={styles.sliderImg} />
                        </View>
                    </ScrollView>
                    {/* Indicators */}
                    <View style={styles.dotsRow}>
                        <View style={[styles.dot, currentSlide === 0 ? styles.dotActive : styles.dotInactive]} />
                        <View style={[styles.dot, currentSlide === 1 ? styles.dotActive : styles.dotInactive]} />
                    </View>
                </View>

                {/* Ride Requests List Section */}
                <View style={styles.requestsSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Solicitações de Corrida</Text>
                        <View style={styles.liveBadge}>
                            <Text style={styles.liveBadgeText}>Ao Vivo</Text>
                        </View>
                    </View>

                    {isOnline ? (
                        requests.length > 0 ? (
                            requests.map(req => (
                                <TouchableOpacity 
                                    key={req.id} 
                                    style={styles.requestCard}
                                    onPress={() => {
                                        navigation.navigate('RequestDetails', { 
                                            trip: req, 
                                            onAccept: (t) => handleAcceptRide(t),
                                            onReject: (t) => handleDeclineRide(t)
                                        });
                                    }}
                                    activeOpacity={0.9}
                                >
                                    <View style={styles.reqTopRow}>
                                        <View style={styles.passengerMeta}>
                                            <View style={styles.avatarFrame}>
                                                <User size={20} color={colors.primary} />
                                            </View>
                                            <View>
                                                <Text style={styles.passengerName}>{req.userName || 'Cliente'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.earningsMeta}>
                                            <Text style={styles.estLabel}>Ganhos Est.</Text>
                                            <Text style={styles.estPrice}>{formatCurrency(req.price || 0)}</Text>
                                        </View>
                                    </View>
                                    
                                    {/* Route points */}
                                    <View style={styles.routeContainer}>
                                        <View style={styles.routePoint}>
                                            <View style={styles.greenCircle} />
                                            <Text style={styles.routeAddrText} numberOfLines={1}>{req.pickupAddress}</Text>
                                        </View>
                                        <View style={styles.connectorLine} />
                                        <View style={styles.routePoint}>
                                            <View style={styles.pinkPin} />
                                            <Text style={styles.routeAddrText} numberOfLines={1}>{req.destAddress || 'Destino'}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.searchingState}>
                                <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 12 }} />
                                <Text style={styles.searchingTitle}>À procura de corridas...</Text>
                                <Text style={styles.searchingSubtitle}>As solicitações próximas a si aparecerão aqui automaticamente.</Text>
                            </View>
                        )
                    ) : (
                        <View style={styles.offlineState}>
                            <Power size={32} color={colors.textMuted} style={{ marginBottom: 12 }} />
                            <Text style={styles.offlineTitle}>Você está offline</Text>
                            <Text style={styles.offlineSubtitle}>Ligue o botão abaixo para começar a receber corridas.</Text>
                        </View>
                    )}
                </View>

                {/* Spacing above floating UI */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* ─── STATUS & GO ONLINE FLOATING ACTION UI ─── */}
            <View style={styles.floatingActionArea}>
                {isOnline && (
                    <Animated.View style={[styles.statusDisplayPill, pulseStyle]}>
                        <View style={styles.whitePulseDot} />
                        <Text style={styles.statusDisplayText}>Aguardando Corridas</Text>
                    </Animated.View>
                )}
                
                <TouchableOpacity 
                    style={[styles.mainToggleBtn, isOnline ? styles.toggleBtnOnline : styles.toggleBtnOffline]} 
                    onPress={toggleOnline}
                    disabled={isOnlineUpdating}
                    activeOpacity={0.9}
                >
                    <Power size={24} color={isOnline ? '#fff' : colors.text} style={{ marginRight: 8 }} />
                    <Text style={[styles.toggleBtnText, { color: isOnline ? '#fff' : colors.text }]}>
                        {isOnline ? 'Ficar Offline' : 'Ficar Online'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    // Top Bar Styles
    topBar: {
        height: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: colors.surfaceContainerHighest,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 0
    },
    topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarMiniBorder: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.primary, overflow: 'hidden' },
    avatarMini: { width: '100%', height: '100%', objectFit: 'cover' },
    logoText: { fontSize: 20, fontWeight: '900', color: colors.primary, letterSpacing: -1 },

    // Scroll View canvas
    scrollCanvas: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16 },

    // Earnings Daily Card
    earningsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 4,
        borderColor: colors.primary,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderTopColor: '#f1f1f5',
        borderRightColor: '#f1f1f5',
        borderBottomColor: '#f1f1f5',
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 20,
    },
    earningsLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    earningsValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
    ridesInfo: { alignItems: 'flex-end' },
    ridesValue: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 4 },

    // Slider Ads Carousel
    sliderWrapper: { width: '100%', height: 180, marginBottom: 24, borderRadius: 16, overflow: 'hidden' },
    sliderScroll: { width: '100%', height: '100%' },
    sliderItem: { width: width - 40, height: 180 },
    sliderImg: { width: '100%', height: '100%', objectFit: 'cover' },
    dotsRow: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotActive: { backgroundColor: colors.primary },
    dotInactive: { backgroundColor: 'rgba(255, 255, 255, 0.5)' },

    // Requests List Section
    requestsSection: { flex: 1 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    liveBadge: { backgroundColor: colors.primaryContainer, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
    liveBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },

    requestCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        marginBottom: 16,
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 1,
    },
    reqTopRow: { flexDirection: 'row', justify: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    passengerMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarFrame: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainer, justifyContent: 'center', alignItems: 'center' },
    passengerName: { fontSize: 15, fontWeight: '750', color: colors.text },
    ratingText: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
    earningsMeta: { alignItems: 'flex-end' },
    estLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase' },
    estPrice: { fontSize: 17, fontWeight: '900', color: colors.primary, marginTop: 2 },

    routeContainer: { paddingLeft: 6, position: 'relative' },
    routePoint: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    greenCircle: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, backgroundColor: '#fff' },
    pinkPin: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
    connectorLine: { width: 2, height: 16, backgroundColor: colors.outlineVariant, marginLeft: 5, marginVertical: 3 },
    routeAddrText: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' },

    searchingState: { alignItems: 'center', paddingVertical: 44 },
    searchingTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
    searchingSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

    offlineState: { alignItems: 'center', paddingVertical: 44 },
    offlineTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
    offlineSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

    // Floating actions
    floatingActionArea: { position: 'absolute', bottom: 20, left: 20, right: 20, alignItems: 'center', gap: 12 },
    statusDisplayPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryContainer,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    whitePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 8 },
    statusDisplayText: { fontSize: 11, fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },

    mainToggleBtn: {
        width: '100%',
        height: 60,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#fff',
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    toggleBtnOffline: { backgroundColor: colors.buttonLight },
    toggleBtnOnline: { backgroundColor: colors.primary },
    toggleBtnText: { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    avatarMiniFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarMiniFallbackText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900'
    },
});
