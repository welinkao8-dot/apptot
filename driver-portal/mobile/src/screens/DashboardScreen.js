import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator, Pressable, Platform, DeviceEventEmitter, PermissionsAndroid } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { SafeAreaView } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import MapboxNavigation from '../native/MapboxNavigation';
import MapboxNavigationLayer from '../components/MapboxNavigationLayer';
import { AuthContext, API_URL } from '../context/AuthContext';
import { getSocket, connectSocket } from '../services/socket';
import colors from '../theme/colors';
import api from '../services/api';
import Toast from 'react-native-toast-message';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    interpolate,
    interpolateColor
} from 'react-native-reanimated';

import LinearGradient from 'react-native-linear-gradient';
import {
    Navigation,
    DollarSign,
    User,
    Bell,
    MapPin,
    ChevronRight,
    XCircle,
    TrendingUp,
    Layers,
    CheckCircle,
    Clock,
    CreditCard,
    Play,
    PlayCircle,
    Square,
    Phone,
    MessageSquare,
    Menu,
    Power,
    Minimize2,
    Maximize2,
    ChevronDown,
    Route,
    ArrowUp,
    ArrowUpLeft,
    ArrowUpRight,
    CornerUpLeft,
    CornerUpRight,
    RotateCcw,
    Volume2,
    VolumeX
} from 'lucide-react-native';
import { formatCurrency } from '../utils/formatters';


import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// Set access token globally for Mapbox
MapboxGL.setAccessToken('pk.eyJ1Ijoicm9seW5nYWx1bGEiLCJhIjoiY21reW4yazd1MGEzcDNlcHZ5ZmxiOWkyeCJ9.h0ixib23eamrzruV6yvqUA');


const { width, height } = Dimensions.get('window');

const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

export default function DashboardScreen({ navigation }) {
    const { user, logout, token } = useContext(AuthContext);
    const [isOnline, setIsOnline] = useState(false);
    const [stats, setStats] = useState({ rides: 0, earnings: 0 });
    const [requests, setRequests] = useState([]);
    const [rideStatus, setRideStatus] = useState('idle');
    const [activeTrip, setActiveTrip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [mountMap, setMountMap] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showSteps, setShowSteps] = useState(false);
    const [cameraState, setCameraState] = useState('FOLLOWING');

    const socket = useRef(null);

    // Animation Values
    const onlineProgress = useSharedValue(0);
    const pulseValue = useSharedValue(1);
    const minimizeAnim = useSharedValue(0);

    // Sync animation with state
    useEffect(() => {
        minimizeAnim.value = withTiming(isMinimized ? 1 : 0, { duration: 400 });
    }, [isMinimized]);

    const animatedPanelStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: interpolate(minimizeAnim.value, [0, 1], [0, 500]) }],
            opacity: interpolate(minimizeAnim.value, [0, 0.8, 1], [1, 0.5, 0]),
        };
    });

    const animatedMaximizeBtnStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: interpolate(minimizeAnim.value, [0.5, 1], [0, 1], 'clamp') }],
            opacity: interpolate(minimizeAnim.value, [0.5, 1], [0, 1], 'clamp'),
        };
    });

    useEffect(() => {
        const loadPersistedState = async () => {
            try {
                const [storedOnline, storedStatus, storedTrip, storedGeometry] = await Promise.all([
                    AsyncStorage.getItem('@tot_is_online'),
                    AsyncStorage.getItem('@tot_ride_status'),
                    AsyncStorage.getItem('@tot_active_trip'),
                    AsyncStorage.getItem('@tot_route_geometry')
                ]);

                if (storedOnline !== null) {
                    const status = storedOnline === 'true';
                    setIsOnline(status);
                    if (status) checkPermissions(); // Request if already online
                }
                if (storedStatus) setRideStatus(storedStatus);
                if (storedTrip) {
                    setActiveTrip(JSON.parse(storedTrip));
                    setMountMap(true);
                }
                if (storedGeometry) setRouteGeometry(storedGeometry);
            } catch (e) {
                console.error('Error loading persisted state:', e);
            } finally {
                setIsLoading(false);
            }
        };

        loadPersistedState();
    }, []);

    useEffect(() => {
        if (token) {
            socket.current = connectSocket(token);
            setupSocketListeners();
        }
        fetchStats();
        return () => { };
    }, [token]);


    const setupSocketListeners = () => {
        if (!socket.current || !user) return;

        socket.current.on('connect', () => {
            console.log('✅ Connected to socket, joining room...');
            if (user?.id) {
                socket.current.emit('join', { userId: user.id, role: 'driver' });
            }
        });

        socket.current.on('login_status', (data) => {
            setIsOnline(data.isOnline);
            AsyncStorage.setItem('@tot_is_online', data.isOnline.toString());
            onlineProgress.value = withSpring(data.isOnline ? 1 : 0);
            if (data.isOnline) fetchPendingTrips();
            setIsLoading(false);
        });


        socket.current.on('new_trip_available', (trip) => {
            console.log('🏎️ DEBUG: New trip available for driver:', JSON.stringify(trip, null, 2));
            setRequests(prev => {
                if (prev.find(r => r.id === trip.id)) return prev;
                return [trip, ...prev];
            });
            Toast.show({
                type: 'info',
                text1: 'Nova Corrida Disponível! 🏎️',
                text2: `De: ${trip.pickupAddress}`,
            });
        });

        socket.current.on('trip_taken', (data) => {
            setRequests(prev => prev.filter(r => r.id !== data.tripId));
        });

        socket.current.on('restore_ride', (trip) => {
            console.log('🔄 Restoring ride from server:', trip.id);
            setActiveTrip(trip);
            setRideStatus(trip.status || 'ongoing');
            AsyncStorage.setItem('@tot_active_trip', JSON.stringify(trip));
            AsyncStorage.setItem('@tot_ride_status', trip.status || 'ongoing');
        });


        socket.current.on('trip_cancelled', () => {
            Toast.show({ type: 'error', text1: 'Corrida cancelada pelo passageiro' });
            resetRide();
        });
    };

    const fetchStats = async () => {
        if (!user) return;
        try {
            const res = await api.get(`/trips/stats/${user.id}`);
            if (res.data) setStats(res.data);
        } catch (e) {
            console.error('Error fetching stats:', e);
        }
    };

    // State for display (updated less frequently)
    const [navDisplayData, setNavDisplayData] = useState({
        instruction: 'Navegação Iniciada',
        distance: 0,
        duration: 0,
        modifier: '',
        maneuvers: [],
        formattedDistance: '',
        formattedDuration: '',
        stepFormattedDistance: '',
        stepFormattedDuration: '',
        formattedEta: '',
        percentageTraveled: 0
    });

    // Ref for high-frequency updates (prevents render storm)
    const navRef = useRef({
        instruction: 'Navegação Iniciada',
        distance: 0,
        duration: 0,
        stepDistance: 0,
        stepDuration: 0,
        modifier: '',
        type: '',
        percentageTraveled: 0
    });

    useEffect(() => {
        // High-frequency listener writes to REF only
        const navListener = DeviceEventEmitter.addListener('onNavigationProgress', (data) => {
            navRef.current = {
                instruction: data.instruction || navRef.current.instruction,
                distance: data.distanceRemaining,
                duration: data.durationRemaining,
                stepDistance: data.stepDistanceRemaining || 0,
                stepDuration: data.stepDurationRemaining || 0,
                modifier: data.modifier,
                type: data.type,
                percentageTraveled: data.percentageTraveled || 0
            };
        });

        // Sync timer updates STATE only once per second
        const syncInterval = setInterval(() => {
            setNavDisplayData(prev => {
                // Only update if data changed significantly or just to keep UI fresh
                return {
                    ...prev,
                    instruction: navRef.current.instruction,
                    distance: navRef.current.distance,
                    duration: navRef.current.duration,
                    modifier: navRef.current.modifier,
                    percentageTraveled: navRef.current.percentageTraveled,
                    formattedDistance: formatDistance(navRef.current.distance),
                    formattedDuration: formatDuration(navRef.current.duration),
                    stepFormattedDistance: formatDistance(navRef.current.stepDistance),
                    stepFormattedDuration: formatDuration(navRef.current.stepDuration)
                };
            });
        }, 1000);

        const routeListener = DeviceEventEmitter.addListener('onRouteChanged', (data) => {
            console.log('🛣️ Route updated in Native');
        });

        const cameraListener = DeviceEventEmitter.addListener('onCameraStateChanged', (data) => {
            setCameraState(data.state);
        });

        const onArrivalListener = DeviceEventEmitter.addListener('onArrival', (data) => {
            console.log('🏁 Arrival detected in JS');
            ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        });

        return () => {
            navListener.remove();
            routeListener.remove();
            cameraListener.remove();
            onArrivalListener.remove();
            clearInterval(syncInterval);
        };
    }, []);

    const toggleMute = () => {
        const newState = !isMuted;
        setIsMuted(newState);
        MapboxNavigation.setMuted(newState);
        process.nextTick(() => {
            ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
        });
    };

    const onLocationUpdate = (location) => {
        if (!location?.coords || !socket.current || !user) return;
        const { longitude, latitude } = location.coords;
        socket.current.emit('update_location', {
            driverId: user.id,
            lat: latitude,
            lng: longitude,
            activeClientId: activeTrip?.clientId || null
        });
    };



    // Periodic stats refresh
    useEffect(() => {
        const interval = setInterval(fetchStats, 60000); // Every minute
        return () => clearInterval(interval);
    }, []);


    const fetchPendingTrips = async () => {
        try {
            const res = await api.get('/trips/pending');
            if (res.data) setRequests(res.data);
        } catch (e) {
            console.error('Error fetching pending trips:', e);
        }
    };

    const checkPermissions = async () => {
        if (Platform.OS !== 'android') return true;

        const permissions = [
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];

        if (Platform.Version >= 33) {
            permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        return granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;
    };

    const toggleOnline = async () => {
        if (!user) return;
        const nextStatus = !isOnline;

        if (nextStatus) {
            const hasPermissions = await checkPermissions();
            if (!hasPermissions) {
                Toast.show({
                    type: 'error',
                    text1: 'Permissão Necessária',
                    text2: 'O app precisa da sua localização para receber corridas.'
                });
                return;
            }
        }

        setIsOnline(nextStatus);
        AsyncStorage.setItem('@tot_is_online', nextStatus.toString());
        onlineProgress.value = nextStatus ? 1 : 0; // Static jump
        ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
        socket.current?.emit('toggle_online', { userId: user.id, isOnline: nextStatus });
        if (!nextStatus) setRequests([]);
        else fetchPendingTrips();
    };



    const animatedToggleStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: onlineProgress.value * 28 }],
            backgroundColor: onlineProgress.value > 0.5 ? '#10b981' : '#f8fafc'
        };
    });

    const animatedTrackStyle = useAnimatedStyle(() => {
        return {
            backgroundColor: onlineProgress.value > 0.5 ? 'rgba(16, 185, 129, 0.4)' : '#334155'
        };
    });


    useEffect(() => {
        // Pulse animation temporarily disabled for stabilization
        pulseValue.value = 1;
    }, [isOnline]);

    // Consolidate pulse styles with precise dependency management to avoid node leakage
    const idlePulseStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: pulseValue.value }],
            opacity: interpolate(onlineProgress.value, [0, 1], [0, 0.6]),
            backgroundColor: colors.primary
        };
    }, [isOnline]);

    const activePulseStyle = useAnimatedStyle(() => {
        const isActiveLine = rideStatus === 'ongoing' || rideStatus === 'finished';
        return {
            transform: [{ scale: pulseValue.value }],
            opacity: interpolate(onlineProgress.value, [0, 1], [0, 0.4]),
            backgroundColor: isActiveLine ? colors.success : colors.primary,
        };
    }, [rideStatus, isOnline]);




    const handleAcceptRide = (trip) => {
        if (!user) return;
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        socket.current?.emit('accept_trip', {
            tripId: trip.id,
            driverId: user.id,
            clientId: trip.clientId,
            driverName: user.full_name
        });
        setActiveTrip(trip);
        setRideStatus('accepted');
        setRequests([]);
        AsyncStorage.setItem('@tot_active_trip', JSON.stringify(trip));
        AsyncStorage.setItem('@tot_ride_status', 'accepted');

        // Safety mount for the map component
        setTimeout(() => {
            setMountMap(true);
        }, 500);
    };


    const handleStartRide = () => {
        if (!activeTrip) return;
        ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
        socket.current?.emit('start_ride', {
            tripId: activeTrip.id,
            clientId: activeTrip.clientId
        });
        setRideStatus('ongoing');
        AsyncStorage.setItem('@tot_ride_status', 'ongoing');
    };

    const handleRecenter = () => {
        ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
        // ❌ REMOVED: recenterCamera not needed - camera follows automatically in SDK 3.x
    };

    const handleOverview = () => {
        ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
        // ❌ REMOVED: showRouteOverview doesn't exist in Navigation SDK 3.x
        // Camera automatically adjusts when nav.setNavigationRoutes() is called
    };


    const handleFinishRide = () => {
        if (!activeTrip) return;
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        // We'll assume a basic fare if not tracked precisely, matching web logic
        const finalFare = activeTrip.price || '0';
        socket.current?.emit('finish_ride', {
            tripId: activeTrip.id,
            clientId: activeTrip.clientId,
            finalFare: finalFare.toString()
        });
        setRideStatus('finished');
        AsyncStorage.setItem('@tot_ride_status', 'finished');
    };


    const handleConfirmPayment = () => {
        if (!activeTrip) return;
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
        socket.current?.emit('confirm_payment', {
            tripId: activeTrip.id,
            clientId: activeTrip.clientId
        });
        setRideStatus('paid'); // Transitions to summary view
        AsyncStorage.setItem('@tot_ride_status', 'paid');
        fetchStats();
    };


    const resetRide = () => {
        setActiveTrip(null);
        setRideStatus('idle');
        AsyncStorage.removeItem('@tot_active_trip');
        AsyncStorage.removeItem('@tot_ride_status');
    };


    const formatDistance = (meters) => {
        if (!meters) return '0 m';
        if (meters < 1000) return `${Math.round(meters)} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '0 min';
        const mins = Math.ceil(seconds / 60);
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hrs}h ${remainingMins}m`;
    };

    const renderTurnIcon = (modifier, size) => {
        const iconSize = size || 20;
        const iconColor = '#fff';

        switch (modifier?.toLowerCase()) {
            case 'left':
            case 'sharp left':
                return <CornerUpLeft size={iconSize} color={iconColor} />;
            case 'right':
            case 'sharp right':
                return <CornerUpRight size={iconSize} color={iconColor} />;
            case 'slight left':
                return <ArrowUpLeft size={iconSize} color={iconColor} />;
            case 'slight right':
                return <ArrowUpRight size={iconSize} color={iconColor} />;
            case 'uturn':
                return <RotateCcw size={iconSize} color={iconColor} />;
            case 'straight':
            default:
                return <ArrowUp size={iconSize} color={iconColor} />;
        }
    };

    const renderActiveRideHeader = () => {
        if (!activeTrip) return null;

        const getStatusColor = () => {
            if (rideStatus === 'accepted') return colors.primary;
            if (rideStatus === 'ongoing') return colors.primary;
            if (rideStatus === 'finished') return colors.success;
            return colors.success;
        };

        const getStatusText = () => {
            if (rideStatus === 'accepted') return 'Buscando Passageiro';
            if (rideStatus === 'ongoing') return 'Em Viagem';
            if (rideStatus === 'finished') return 'Chegou ao Destino';
            return 'Viagem Concluída';
        };

        return (
            <LinearGradient
                colors={['#0f172a', 'rgba(15, 23, 42, 0.9)', 'transparent']}
                style={styles.newTopHeader}
            >
                <SafeAreaView edges={['top']}>
                    <View style={styles.headerContent}>
                        {/* MANEUVER / STATUS LOGIC */}
                        <View style={styles.navInstructionArea}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                {rideStatus === 'ongoing' && (
                                    <View style={styles.turnIconBadge}>
                                        {renderTurnIcon(navDisplayData.modifier)}
                                    </View>
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.navInstructionText} numberOfLines={1}>
                                        {rideStatus === 'ongoing' ? navDisplayData.instruction : (rideStatus === 'accepted' ? 'Caminho do Passageiro' : 'Fim da Viagem')}
                                    </Text>
                                    {(rideStatus === 'ongoing' || rideStatus === 'accepted') && navDisplayData.stepFormattedDistance !== '' && (
                                        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>
                                            em {navDisplayData.stepFormattedDistance}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <View style={styles.headerMetricsContainer}>
                                <View style={styles.headerMetricBox}>
                                    <Clock size={12} color={colors.textSecondary} />
                                    <Text style={styles.headerMetricValue}>{navDisplayData.stepFormattedDuration}</Text>
                                </View>
                                <View style={styles.headerMetricBox}>
                                    <Route size={12} color={colors.textSecondary} />
                                    <Text style={styles.headerMetricValue}>{navDisplayData.stepFormattedDistance}</Text>
                                </View>
                            </View>
                        </View>

                        {/* RIGHT: STATUS PILL + MUTE TOGGLE */}
                        <View style={styles.headerRightInfo}>
                            <TouchableOpacity
                                onPress={toggleMute}
                                style={[styles.muteToggleButton, isMuted && styles.muteToggleActive]}
                            >
                                {isMuted ? (
                                    <VolumeX size={18} color="#ef4444" />
                                ) : (
                                    <Volume2 size={18} color={colors.primary} />
                                )}
                            </TouchableOpacity>

                            <View style={[styles.statusPillPremium, { borderColor: getStatusColor() + '40' }]}>
                                <View style={[styles.statusDotSmall, { backgroundColor: getStatusColor() }]} />
                                <Text style={[styles.statusLabelPremium, { color: getStatusColor() }]}>{getStatusText()}</Text>
                            </View>
                        </View>
                    </View>

                    {/* EXPANDABLE STEPS LIST */}
                    {rideStatus === 'ongoing' && navDisplayData.maneuvers.length > 0 && (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                                setShowSteps(!showSteps);
                                ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                            }}
                            style={styles.expandStepsHandle}
                        >
                            <View style={[styles.minimizeHandleBar, { width: 40, opacity: 0.3 }]} />
                        </TouchableOpacity>
                    )}

                    {showSteps && rideStatus === 'ongoing' && (
                        <Animated.View style={styles.stepsListContainer}>
                            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                                {navDisplayData.maneuvers.map((step, idx) => (
                                    <View key={`step-${idx}`} style={styles.stepItemRow}>
                                        <View style={styles.stepIconSmall}>
                                            {renderTurnIcon(step.modifier, 16)}
                                        </View>
                                        <View style={styles.stepInfoContainer}>
                                            <Text style={styles.stepInstructionText}>{step.instruction}</Text>
                                            <Text style={styles.stepDistanceText}>{formatDistance(step.distance)}</Text>
                                        </View>
                                        <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                                    </View>
                                ))}
                            </ScrollView>
                        </Animated.View>
                    )}
                </SafeAreaView>
            </LinearGradient>
        );
    };

    if (isLoading && !user) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const isRideActive = ['accepted', 'ongoing', 'finished', 'paid'].includes(rideStatus);

    if (isRideActive && activeTrip) {
        return (
            <View style={styles.activeRideContainer}>
                {renderActiveRideHeader()}

                <View style={{ flex: 1 }}>
                    {mountMap ? (
                        <MapboxNavigationLayer
                            trip={activeTrip}
                            rideStatus={rideStatus}
                            isMinimized={isMinimized}
                            onToggleMinimize={() => setIsMinimized(!isMinimized)}
                            onLocationUpdate={onLocationUpdate}
                            onProgressUpdate={(data) => {
                                socket.current?.emit('trip_progress', {
                                    ...data,
                                    tripId: activeTrip.id,
                                    clientId: activeTrip.clientId
                                });
                            }}
                        />
                    ) : (
                        <View style={[styles.centered, { flex: 1, backgroundColor: colors.background }]}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    )}

                    {/* ANIMATED FLOATING CARD */}
                    <Animated.View style={[styles.activeRideFloatingPanel, animatedPanelStyle]}>
                        {/* INTEGRATED MINIMIZE HANDLE */}
                        <TouchableOpacity
                            style={styles.minimizeHandleArea}
                            onPress={() => setIsMinimized(true)}
                        >
                            <View style={styles.minimizeHandleBar} />
                        </TouchableOpacity>

                        {/* TRIP PROGRESS BAR */}
                        {rideStatus === 'ongoing' && (
                            <View style={styles.progressBarContainer}>
                                <View style={[styles.progressBarFill, { width: `${navDisplayData.percentageTraveled * 100}%` }]} />
                                <View style={styles.progressMarker} />
                            </View>
                        )}

                        <View style={styles.reqInfoRow}>
                            <View style={styles.clientAvatar}>
                                <User size={22} color={colors.textSecondary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.reqName}>{activeTrip.userName || 'Passageiro'}</Text>
                                <View style={styles.activeBadgeRow}>
                                    <View style={[styles.statusPillSmall, { backgroundColor: (rideStatus === 'accepted' || rideStatus === 'ongoing') ? 'rgba(233, 30, 99, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                                        <View style={[styles.pulseDotSmall, { backgroundColor: (rideStatus === 'accepted' || rideStatus === 'ongoing') ? colors.primary : colors.success }]} />
                                        <View style={styles.pulseDotInnerSmall} />
                                        <Text style={[styles.activeRideTitleSmall, { color: (rideStatus === 'accepted' || rideStatus === 'ongoing') ? colors.primary : colors.success }]}>
                                            {rideStatus === 'accepted' ? 'A CAMINHO' : rideStatus === 'ongoing' ? 'EM CURSO' : 'CONCLUÍDA'}
                                        </Text>
                                    </View>
                                    <Text style={styles.reqRating}>⭐ 4.9</Text>
                                </View>
                            </View>
                        </View>

                        {/* ADDRESSES */}
                        <View style={styles.addressRow}>
                            <MapPin size={16} color={colors.primary} />
                            <Text style={styles.reqAddr} numberOfLines={1}>De: {activeTrip.pickupAddress}</Text>
                        </View>
                        <View style={[styles.addressRow, { marginTop: -8, marginBottom: 12 }]}>
                            <Navigation size={16} color={colors.success} />
                            <Text style={styles.reqAddr} numberOfLines={1}>Para: {activeTrip.destAddress || 'Destino'}</Text>
                        </View>

                        {/* TRIP PROGRESS SUMMARY (ETA/DISTANCE) */}
                        {rideStatus === 'ongoing' && (
                            <View style={styles.tripSummaryFooter}>
                                <View style={styles.tripSummaryItem}>
                                    <Text style={styles.tripSummaryLabel}>CHEGADA</Text>
                                    <Text style={styles.tripSummaryValue}>{navDisplayData.formattedEta || '--:--'}</Text>
                                </View>
                                <View style={styles.tripSummaryDivider} />
                                <View style={styles.tripSummaryItem}>
                                    <Text style={styles.tripSummaryLabel}>DISTÂNCIA</Text>
                                    <Text style={styles.tripSummaryValue}>{navDisplayData.formattedDistance || '--'}</Text>
                                </View>
                                <View style={styles.tripSummaryDivider} />
                                <View style={styles.tripSummaryItem}>
                                    <Text style={styles.tripSummaryLabel}>TEMPO</Text>
                                    <Text style={styles.tripSummaryValue}>{navDisplayData.formattedDuration || '--'}</Text>
                                </View>
                            </View>
                        )}

                        <View style={{ marginBottom: 15 }} />

                        {/* ACTIONS */}
                        {rideStatus === 'accepted' && (
                            <TouchableOpacity style={styles.finishBtnTouch} onPress={handleStartRide}>
                                <LinearGradient colors={colors.gradients.pink} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.acceptBtnGradient}>
                                    <Text style={styles.acceptBtnText}>INICIAR CORRIDA</Text>
                                    <Play size={20} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}

                        {rideStatus === 'ongoing' && (
                            <TouchableOpacity style={styles.finishBtnTouch} onPress={handleFinishRide}>
                                <LinearGradient colors={colors.gradients.emerald} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.acceptBtnGradient}>
                                    <Text style={styles.acceptBtnText}>FINALIZAR CORRIDA</Text>
                                    <CheckCircle size={20} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}

                        {rideStatus === 'finished' && (
                            <View style={styles.summarySection}>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryBox}>
                                    <Text style={styles.summaryLabel}>Valor do Recebimento</Text>
                                    <Text style={styles.summaryValueBig}>{formatCurrency(activeTrip.price)}</Text>
                                </View>
                                <TouchableOpacity style={styles.finishBtnTouch} onPress={handleConfirmPayment}>
                                    <LinearGradient colors={colors.gradients.blue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.acceptBtnGradient}>
                                        <Text style={styles.acceptBtnText}>CONFIRMAR PAGAMENTO</Text>
                                        <CreditCard size={20} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}

                        {rideStatus === 'paid' && (
                            <View style={styles.receiptSection}>
                                <View style={styles.receiptHeaderRow}>
                                    <CheckCircle size={24} color={colors.success} />
                                    <Text style={styles.receiptTitleSmall}>PAGAMENTO CONFIRMADO</Text>
                                </View>
                                <TouchableOpacity style={styles.finishBtnTouch} onPress={resetRide}>
                                    <LinearGradient colors={colors.gradients.emerald} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.acceptBtnGradient}>
                                        <Text style={styles.acceptBtnText}>CONCLUIR</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity onPress={resetRide} style={styles.closeFloatingBtn}>
                            <XCircle size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* ANIMATED MAXIMIZE BUTTON */}
                    <Animated.View style={[styles.maximizeBtnContainer, animatedMaximizeBtnStyle]}>
                        <TouchableOpacity onPress={() => setIsMinimized(false)}>
                            <LinearGradient
                                colors={colors.gradients.pink}
                                style={styles.maximizeBtn}
                            >
                                <Maximize2 size={30} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </View >
        );
    }

    return (
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                {/* HEADER */}
                <View style={styles.header}>

                    <View style={styles.userInfo}>
                        <LinearGradient colors={colors.gradients.pink} style={styles.avatar}>
                            <Text style={styles.avatarText}>{user?.full_name?.charAt(0) || 'D'}</Text>
                        </LinearGradient>
                        <View>
                            <Text style={styles.welcomeText}>Olá, {user?.full_name?.split(' ')[0]}</Text>
                            <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.textMuted }]}>
                                {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </Text>
                        </View>
                    </View>

                    <Pressable onPress={toggleOnline} style={styles.toggleContainer}>
                        <Animated.View style={[styles.toggleTrack, animatedTrackStyle]}>
                            <Animated.View style={[styles.toggleThumb, animatedToggleStyle]} />
                        </Animated.View>
                    </Pressable>
                </View>


                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* STATS GRID */}
                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>

                            <LinearGradient colors={colors.gradients.pink} style={styles.statGradient}>
                                <View style={styles.statIconBadge}>
                                    <TrendingUp size={24} color="#fff" />
                                </View>
                                <Text style={styles.statValue}>{stats.rides}</Text>
                                <Text style={styles.statLabel}>Corridas hoje</Text>
                            </LinearGradient>
                        </View>

                        <View style={styles.statBox}>
                            <LinearGradient colors={colors.gradients.blue} style={styles.statGradient}>
                                <View style={styles.statIconBadge}>
                                    <DollarSign size={24} color="#fff" />
                                </View>
                                <Text style={styles.statValue}>{formatCurrency(stats.earnings)}</Text>
                                <Text style={styles.statLabel}>Ganhos hoje</Text>
                            </LinearGradient>
                        </View>


                    </View>

                    {/* REQUESTS LIST */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Solicitações Próximas</Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countText}>{requests.length}</Text>
                        </View>
                    </View>

                    {isOnline ? (
                        requests.length > 0 ? (
                            requests.map((req, index) => (
                                <View key={req.id}>
                                    <TouchableOpacity style={styles.requestCard} onPress={() => handleAcceptRide(req)}>

                                        <View style={styles.reqInfoRow}>
                                            <View style={styles.clientAvatar}>
                                                <User size={22} color={colors.textSecondary} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.reqName}>{req.userName || 'Passageiro'}</Text>
                                                <Text style={styles.reqRating}>⭐ 4.9 • TOT Premium</Text>
                                            </View>
                                            <Text style={styles.reqPrice}>Kz {req.price}</Text>
                                        </View>
                                        <View style={styles.addressRow}>
                                            <MapPin size={16} color={colors.primary} />
                                            <Text style={styles.reqAddr} numberOfLines={1}>De: {req.pickupAddress}</Text>
                                        </View>
                                        <View style={[styles.addressRow, { marginTop: -8, marginBottom: 16 }]}>
                                            <Navigation size={16} color={colors.success} />
                                            <Text style={styles.reqAddr} numberOfLines={1}>Para: {req.destAddress || 'Destino'}</Text>
                                        </View>
                                        <LinearGradient colors={colors.gradients.emerald} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.acceptBtnGradient}>
                                            <Text style={styles.acceptBtnText}>ACEITAR CORRIDA</Text>
                                            <ChevronRight size={20} color="#fff" />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            ))

                        ) : (
                            <View style={styles.emptyContainer}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.emptyText}>Buscando passageiros próximos...</Text>
                            </View>
                        )
                    ) : (
                        <View style={styles.offlineBox}>
                            <Bell size={48} color={colors.textMuted} style={{ marginBottom: 16, opacity: 0.5 }} />
                            <Text style={styles.offlineText}>Aproveite o tempo livre ou fique disponível para ganhar dinheiro hoje!</Text>
                        </View>
                    )}
                </ScrollView>

                {/* HIDDEN LOCATION TRACKER TEMPORARILY DISABLED FOR DEBUGGING */}
                {/* 
                {isOnline && !isRideActive && (
                    <View style={{ height: 1, width: 1, opacity: 0, position: 'absolute', top: -100 }}>
                        <MapboxGL.MapView
                            logoEnabled={false}
                            attributionEnabled={false}
                        >
                            <MapboxGL.UserLocation 
                                visible={true} 
                                onUpdate={onLocationUpdate} 
                                minDisplacement={10}
                                pulsing={{ enabled: false }}
                            />
                        </MapboxGL.MapView>
                    </View>
                )}
                */}



            </SafeAreaView>

        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
        marginTop: 10,
        marginHorizontal: 16,
        borderRadius: 24,
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 20,
    },
    welcomeText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    },
    toggleContainer: {
        width: 64,
        height: 32,
    },
    toggleTrack: {
        flex: 1,
        backgroundColor: '#334155',
        borderRadius: 16,
        justifyContent: 'center',
        padding: 4,
    },
    toggleThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        elevation: 4,
    },
    mainStatusCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 32,
        padding: 30,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    radarContainer: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    radarPulse: {
        position: 'absolute',
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: colors.primary,
        opacity: 0.2,
    },
    radarInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(233, 30, 99, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(233, 30, 99, 0.2)',
    },
    idleTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 8,
    },
    idleSub: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 10,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 32,
    },
    statBox: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    statGradient: {
        paddingVertical: 24,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statIconBadge: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statValue: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 4,
        textAlign: 'center',
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
    },
    countBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    countText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    requestCard: {
        backgroundColor: colors.surfaceLight,
        padding: 20,
        borderRadius: 28,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    reqInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    clientAvatar: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reqName: {
        fontSize: 17,
        fontWeight: 'bold',
        color: colors.text,
    },
    reqRating: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    reqPrice: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.success,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    reqAddr: {
        fontSize: 14,
        color: colors.textSecondary,
        flex: 1,
    },
    acceptBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
    },
    acceptBtnText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: 0.5,
    },
    emptyContainer: {
        padding: 30,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: 14,
        fontWeight: '500',
    },
    offlineBox: {
        padding: 40,
        alignItems: 'center',
    },
    offlineText: {
        color: colors.textMuted,
        fontWeight: '600',
        textAlign: 'center',
        fontSize: 15,
    },
    activeRideFloatingPanel: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: colors.surface,
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        marginTop: 10,
        marginHorizontal: 15,
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        zIndex: 100,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    activeRideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(233, 30, 99, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    pulseDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
        position: 'absolute',
    },
    pulseDotInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
        zIndex: 2,
    },
    activeRideTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: colors.primary,
        letterSpacing: 1.5,
    },
    activeRideDest: {
        fontSize: 22,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 20,
        lineHeight: 28,
    },
    finishBtnGradient: {
        paddingVertical: 16,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    receiptLabel: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    receiptValueBig: {
        color: colors.success,
        fontSize: 20,
        fontWeight: 'bold',
    },
    receiptDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 15,
    },
    receiptFooterText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    closeBtn: {
        padding: 4,
    },
    activeBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    statusPillSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    pulseDotSmall: {
        width: 8,
        height: 8,
        borderRadius: 4,
        zIndex: 2,
    },
    pulseDotInnerSmall: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        position: 'absolute',
        left: 6,
        zIndex: 1,
    },

    activeRideTitleSmall: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    summarySection: {
        marginTop: 10,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: colors.glassBorder,
        marginBottom: 20,
    },
    summaryLabel: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    summaryValueBig: {
        color: colors.success,
        fontSize: 28,
        fontWeight: '900',
        marginBottom: 20,
    },
    receiptSection: {
        paddingVertical: 10,
    },
    receiptHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    receiptTitleSmall: {
        color: colors.success,
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
    },
    closeFloatingBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
    },

    // NEW ACTIVE RIDE UI STYLES
    activeRideContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    newTopHeader: {
        width: '100%',
        paddingBottom: 12,
        backgroundColor: '#0f172a',
        borderBottomWidth: 1.5,
        borderBottomColor: 'rgba(233, 30, 99, 0.4)', // Subtle pink accent
        zIndex: 1000,
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 0 : 20,
    },
    navInstructionArea: {
        flex: 1,
        marginRight: 10,
    },
    navInstructionText: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    headerMetricsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerMetricBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    headerMetricValue: {
        color: '#f8fafc',
        fontSize: 13,
        fontWeight: '700',
    },
    headerRightInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerPriceContainer: {
        alignItems: 'flex-end',
    },
    headerPriceValueRefined: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    statusPillPremium: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    statusDotSmall: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusLabelPremium: {
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    headerRowSpace: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    // NEW MINIMIZE HANDLE STYLES
    minimizeHandleArea: {
        width: '100%',
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -12,
        marginBottom: 8,
    },
    minimizeHandleBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    maximizeBtn: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    maximizeBtnContainer: {
        position: 'absolute',
        bottom: 50,
        left: 30,
        elevation: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.6,
        shadowRadius: 15,
        zIndex: 9999,
    },
    turnIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    muteToggleButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(148, 163, 184, 0.2)',
    },
    muteToggleActive: {
        borderColor: 'rgba(239, 68, 68, 0.4)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    expandStepsHandle: {
        width: '100%',
        height: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -5,
    },
    stepsListContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    stepItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    stepIconSmall: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        opacity: 0.7,
    },
    stepInfoContainer: {
        flex: 1,
    },
    stepInstructionText: {
        color: '#f8fafc',
        fontSize: 14,
        fontWeight: '600',
    },
    stepDistanceText: {
        color: colors.primary,
        fontSize: 12,
        fontWeight: '800',
        marginTop: 2,
    },
    // TRIP PROGRESS STYLES
    progressBarContainer: {
        height: 6,
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 3,
        marginBottom: 20,
        overflow: 'hidden',
        position: 'relative',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 3,
    },
    progressMarker: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tripSummaryFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.15)',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    tripSummaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    tripSummaryLabel: {
        color: colors.textSecondary,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 4,
    },
    tripSummaryValue: {
        color: '#f8fafc',
        fontSize: 14,
        fontWeight: '800',
    },
    tripSummaryDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    // CAMERA CONTROLS
    cameraControlsContainer: {
        position: 'absolute',
        right: 16,
        bottom: 300, // Above the floating panel
        alignItems: 'center',
        gap: 12,
        zIndex: 1000,
    },
    cameraControlBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
});

