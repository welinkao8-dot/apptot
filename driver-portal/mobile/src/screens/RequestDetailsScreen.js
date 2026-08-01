import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, 
    ActivityIndicator, Platform, StatusBar, Dimensions
} from 'react-native';
import colors from '../theme/colors';
import { User, Bell, Info, ArrowLeft, CheckCircle } from 'lucide-react-native';
import { formatCurrency } from '../utils/formatters';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { getSocket } from '../services/socket';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');
const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

export default function RequestDetailsScreen({ route, navigation }) {
    const { trip, onAccept } = route.params || {};
    const [timer, setTimer] = useState(15);
    const timerInterval = useRef(null);

    // Timer logic
    useEffect(() => {
        setTimer(15);
        timerInterval.current = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) {
                    clearInterval(timerInterval.current);
                    ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
                    navigation.goBack();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerInterval.current) clearInterval(timerInterval.current);
        };
    }, []);

    // Socket listeners for background cancellations or assignment to other drivers
    useEffect(() => {
        const socket = getSocket();
        if (socket && trip) {
            const handleTripTaken = (data) => {
                if (data.tripId === trip.id) {
                    ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
                    Toast.show({ 
                        type: 'info', 
                        text1: 'Corrida indisponível', 
                        text2: 'Esta corrida já foi aceita por outro motorista.' 
                    });
                    navigation.goBack();
                }
            };

            const handleTripCancelled = (data) => {
                // If it is the current trip
                if (data?.tripId === trip.id) {
                    ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
                    Toast.show({ 
                        type: 'error', 
                        text1: 'Corrida Cancelada', 
                        text2: 'A corrida foi cancelada pelo passageiro.' 
                    });
                    navigation.goBack();
                }
            };

            socket.on('trip_taken', handleTripTaken);
            socket.on('trip_cancelled', handleTripCancelled);

            return () => {
                socket.off('trip_taken', handleTripTaken);
                socket.off('trip_cancelled', handleTripCancelled);
            };
        }
    }, [trip]);

    const handleAccept = () => {
        if (onAccept && trip) {
            onAccept(trip);
        }
        navigation.goBack();
    };

    const handleReject = () => {
        ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
        navigation.goBack();
    };

    if (!trip) return null;

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

            {/* ─── TOP APP BAR ─── */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <TouchableOpacity style={styles.backBtn} onPress={handleReject} activeOpacity={0.8}>
                        <ArrowLeft size={22} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.logoText}>TOT</Text>
                </View>
                <View style={styles.titleWrapper}>
                    <Info size={16} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.titleText}>Nova Corrida</Text>
                </View>
                <View style={[styles.timerPill, timer <= 5 && styles.timerPillWarning]}>
                    <Text style={styles.timerPillText}>
                        Expira em: <Text style={{ fontWeight: '950' }}>{timer}s</Text>
                    </Text>
                </View>
            </View>

            {/* ─── PROMOTIONAL BANNER AREA ─── */}
            <View style={styles.bannerContainer}>
                <Image 
                    source={{ uri: 'https://lh3.googleusercontent.com/aida/AP1WRLujdYRp3SrZiujUZ1c03tcvXOOZEqoMcJU6Ee3rY_RD6DutWlz5P4bgkjyfQtu3gby1A-dGeO7OTSzdjrYd8QPOwo8SFqbjmaHA4WdTD06bH1SggE18LliKdsRkLO8k4iMPIobSvAZh0DvHPplNRe5LiMV1UGzvRzuHZ3ePjteH_DGACaoP7w_9eiXeq7P7DJJBYJWtCQL6k3zjAs7gvKbYcB-0-vdJnS2KT469z2IWmga3EKvwNruYj_2z' }} 
                    style={styles.bannerImg} 
                />
            </View>

            {/* ─── REQUEST DETAILS CARD ─── */}
            <View style={styles.detailsCard}>
                <View style={styles.cardAccent} />
                
                <View style={styles.cardContent}>
                    {/* Passenger & Estimated Earnings */}
                    <View style={styles.metaRow}>
                        <View style={styles.passengerMeta}>
                            <View style={styles.avatarBorder}>
                                <User size={24} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.passengerName}>{trip.userName || 'Marco Silva'}</Text>
                                <Text style={styles.ratingText}>⭐ {trip.userRating || 4.9} • {trip.userTrips || '240 viagens'}</Text>
                            </View>
                        </View>
                        <View style={styles.earningsMeta}>
                            <Text style={styles.estLabel}>Ganhos Estimados</Text>
                            <Text style={styles.estValue}>{formatCurrency(trip.price || 0)}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Route Details */}
                    <View style={styles.routeContainer}>
                        <View style={styles.routePoint}>
                            <View style={styles.greenCircle} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.routeLabel}>Ponto de Partida</Text>
                                <Text style={styles.routeValue}>{trip.pickupAddress}</Text>
                            </View>
                        </View>
                        
                        <View style={styles.connectorLine} />

                        <View style={styles.routePoint}>
                            <View style={styles.pinkPin} />
                            <View style={styles.destRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.routeLabel}>Destino</Text>
                                    <Text style={styles.routeValue}>{trip.destAddress || 'Destino'}</Text>
                                </View>
                                <View style={styles.distanceBadge}>
                                    <Text style={styles.distanceText}>4.2 km</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Action buttons */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} activeOpacity={0.8}>
                            <Text style={styles.rejectBtnTxt}>REJEITAR</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.9}>
                            <CheckCircle size={18} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.acceptBtnTxt}>ACEITAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
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
    topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    backBtn: { padding: 4 },
    logoText: { fontSize: 18, fontWeight: '950', color: colors.primary, letterSpacing: -1 },
    titleWrapper: { flexDirection: 'row', alignItems: 'center' },
    titleText: { fontSize: 14, fontWeight: '750', color: colors.text },
    timerPill: {
        backgroundColor: colors.primaryContainer,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2
    },
    timerPillWarning: { backgroundColor: colors.error },
    timerPillText: { fontSize: 11, fontWeight: '700', color: '#fff' },

    // Banner
    bannerContainer: { flex: 1, width: '100%', backgroundColor: colors.surfaceContainer },
    bannerImg: { width: '100%', height: '100%', objectFit: 'cover' },

    // Details Card
    detailsCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 8,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20
    },
    cardAccent: { height: 4, backgroundColor: colors.primary },
    cardContent: { padding: 20 },

    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    passengerMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarBorder: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceContainerLow },
    passengerName: { fontSize: 15, fontWeight: '800', color: colors.text },
    ratingText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    earningsMeta: { alignItems: 'flex-end' },
    estLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
    estValue: { fontSize: 22, fontWeight: '950', color: colors.primary, marginTop: 2 },

    divider: { height: 1, backgroundColor: colors.surfaceContainerHighest, marginVertical: 14 },

    routeContainer: { position: 'relative', gap: 12, paddingLeft: 6, marginBottom: 24 },
    routePoint: { flexDirection: 'row', gap: 12 },
    greenCircle: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, backgroundColor: '#fff', marginTop: 4 },
    pinkPin: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 4 },
    connectorLine: { width: 2, height: 20, backgroundColor: colors.surfaceContainerHighest, marginLeft: 5, position: 'absolute', top: 20 },
    routeLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    routeValue: { fontSize: 14, fontWeight: '750', color: colors.text, marginTop: 2 },

    destRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    distanceBadge: { backgroundColor: colors.surfaceContainerLow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    distanceText: { fontSize: 12, fontWeight: '750', color: colors.text },

    actionsRow: { flexDirection: 'row', gap: 12 },
    rejectBtn: {
        flex: 1, height: 56, borderRadius: 12, borderWidth: 2, borderColor: colors.textSecondary,
        justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff'
    },
    rejectBtnTxt: { fontSize: 15, fontWeight: '900', color: colors.textSecondary },
    acceptBtn: {
        flex: 2, height: 56, borderRadius: 12, backgroundColor: colors.primary,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4
    },
    acceptBtnTxt: { fontSize: 15, fontWeight: '900', color: '#fff' }
});
