import React, { useState, useEffect, useContext, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Platform, DeviceEventEmitter,
    PermissionsAndroid, StatusBar, Dimensions, Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openNavigationApp } from '../utils/openNavigation';
import { AuthContext } from '../context/AuthContext';
import { connectSocket } from '../services/socket';
import colors from '../theme/colors';
import api from '../services/api';
import Toast from 'react-native-toast-message';
import { NativeModules } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, interpolate } from 'react-native-reanimated';

import { Bell, User, Power, Info } from 'lucide-react-native';

import GoingToClientView from '../components/ride/GoingToClientView';
import OngoingRideView from '../components/ride/OngoingRideView';
import AwaitingPaymentView from '../components/ride/AwaitingPaymentView';
import { formatCurrency } from '../utils/formatters';

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
    const socket = useRef(null);

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
        const load = async () => {
            try {
                const [so, ss, st] = await Promise.all([
                    AsyncStorage.getItem('@tot_is_online'),
                    AsyncStorage.getItem('@tot_ride_status'),
                    AsyncStorage.getItem('@tot_active_trip'),
                ]);
                if (so !== null) {
                    const online = so === 'true';
                    setIsOnline(online);
                    if (online && LocationModule) checkPermissions().then(ok => { if (ok) LocationModule.startLocationUpdates(); });
                }
                if (ss) setRideStatus(ss);
                if (st) setActiveTrip(JSON.parse(st));
            } catch (e) { console.error(e); }
            finally { setIsLoading(false); }
        };
        load();
    }, []);

    useEffect(() => {
        if (token) { socket.current = connectSocket(token); setupSocketListeners(); }
        fetchStats();
        return () => {};
    }, [token]);

    const setupSocketListeners = () => {
        if (!socket.current || !user) return;
        socket.current.on('connect', () => { if (user?.id) socket.current.emit('join', { userId: user.id, role: 'driver' }); });
        socket.current.on('login_status', (data) => {
            setIsOnline(data.isOnline);
            AsyncStorage.setItem('@tot_is_online', data.isOnline.toString());
            if (data.isOnline) { fetchPendingTrips(); if (LocationModule) LocationModule.startLocationUpdates(); }
            else { if (LocationModule) LocationModule.stopLocationUpdates(); }
        });
        socket.current.on('new_trip_available', (trip) => {
            setRequests(prev => prev.find(r => r.id === trip.id) ? prev : [trip, ...prev]);
            ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
            navigation.navigate('RequestDetails', { 
                trip: trip, 
                onAccept: (t) => handleAcceptRide(t)
            });
        });
        socket.current.on('trip_taken', (data) => {
            setRequests(prev => prev.filter(r => r.id !== data.tripId));
        });
        socket.current.on('restore_ride', (trip) => {
            setActiveTrip(trip); setRideStatus(trip.status || 'ongoing');
            AsyncStorage.setItem('@tot_active_trip', JSON.stringify(trip));
            AsyncStorage.setItem('@tot_ride_status', trip.status || 'ongoing');
        });
        socket.current.on('trip_cancelled', () => { Toast.show({ type: 'error', text1: 'Corrida cancelada.' }); resetRide(); });
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
            console.error('Error fetching dashboard stats:', e);
        } 
    };
    const fetchPendingTrips = async () => { try { const r = await api.get('/trips/pending'); if (r.data) setRequests(r.data); } catch (e) {} };

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('onLocationUpdate', (loc) => {
            if (!loc?.coords || !socket.current || !user) return;
            socket.current.emit('update_location', { driverId: user.id, lat: loc.coords.latitude, lng: loc.coords.longitude, activeClientId: activeTrip?.clientId || null });
        });
        return () => sub.remove();
    }, [activeTrip]);

    const checkPermissions = async () => {
        if (Platform.OS !== 'android') return true;
        const perms = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
        if (Platform.Version >= 33) perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        const g = await PermissionsAndroid.requestMultiple(perms);
        return g['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;
    };

    const toggleOnline = async () => {
        if (!user) return;
        const next = !isOnline;
        if (next) {
            const ok = await checkPermissions();
            if (!ok) { Toast.show({ type: 'error', text1: 'Permissão de localização necessária.' }); return; }
            if (LocationModule) LocationModule.startLocationUpdates();
        } else { if (LocationModule) LocationModule.stopLocationUpdates(); }
        setIsOnline(next);
        AsyncStorage.setItem('@tot_is_online', next.toString());
        ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
        socket.current?.emit('toggle_online', { userId: user.id, isOnline: next });
        if (!next) setRequests([]); else fetchPendingTrips();
    };

    const handleAcceptRide = (trip) => {
        if (!user) return;
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        socket.current?.emit('accept_trip', { tripId: trip.id, driverId: user.id, clientId: trip.clientId, driverName: user.full_name });
        setActiveTrip(trip); setRideStatus('accepted'); setRequests([]);
        AsyncStorage.setItem('@tot_active_trip', JSON.stringify(trip));
        AsyncStorage.setItem('@tot_ride_status', 'accepted');
    };

    const handleStartRide = () => {
        if (!activeTrip) return;
        ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
        socket.current?.emit('start_ride', { tripId: activeTrip.id, clientId: activeTrip.clientId });
        setRideStatus('ongoing'); AsyncStorage.setItem('@tot_ride_status', 'ongoing');
    };

    const handleFinishRide = () => {
        if (!activeTrip) return;
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        socket.current?.emit('finish_ride', { tripId: activeTrip.id, clientId: activeTrip.clientId, finalFare: (activeTrip.price || '0').toString() });
        setRideStatus('finished'); AsyncStorage.setItem('@tot_ride_status', 'finished');
    };

    const handleConfirmPayment = () => {
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        resetRide(); fetchStats();
    };

    const resetRide = () => {
        setActiveTrip(null); setRideStatus('idle');
        AsyncStorage.removeItem('@tot_active_trip'); AsyncStorage.removeItem('@tot_ride_status');
    };

    if (isLoading) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;

    if (rideStatus === 'accepted') return <GoingToClientView user={user} activeTrip={activeTrip} onStartRide={handleStartRide} onOpenMap={() => openNavigationApp(activeTrip?.coords?.lat, activeTrip?.coords?.lng, 'Local de Recolha')} />;
    if (rideStatus === 'ongoing') return <OngoingRideView user={user} activeTrip={activeTrip} onFinishRide={handleFinishRide} onOpenMap={() => openNavigationApp(activeTrip?.destPos?.lat, activeTrip?.destPos?.lng, 'Destino')} />;
    if (rideStatus === 'finished') return <AwaitingPaymentView user={user} activeTrip={activeTrip} onConfirmPayment={handleConfirmPayment} />;

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
                <TouchableOpacity style={styles.notifyBtn} activeOpacity={0.8}>
                    <Bell size={20} color={colors.primary} />
                </TouchableOpacity>
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
                                            onAccept: (t) => handleAcceptRide(t)
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
                                                <Text style={styles.passengerName}>{req.userName || 'Passageiro'}</Text>
                                                <Text style={styles.ratingText}>⭐ 4.9</Text>
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
    notifyBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },

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
