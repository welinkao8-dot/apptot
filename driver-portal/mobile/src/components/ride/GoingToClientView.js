import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, Platform } from 'react-native';
import colors from '../../theme/colors';
import { User, Bell, MessageSquare, Map, Bolt, Navigation } from 'lucide-react-native';

export default function GoingToClientView({ user, activeTrip, onOpenMap, onStartRide }) {
    if (!activeTrip) return null;

    const distanceText = activeTrip.distance
        ? `${parseFloat(activeTrip.distance).toFixed(1)}`
        : '4.8';

    const durationText = activeTrip.duration
        ? `${Math.round(activeTrip.duration / 60)}`
        : '12';

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
            <View style={styles.mainCanvas}>
                {/* Status Indicator */}
                <View style={styles.statusRow}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.statusText}>Aguardando Passageiro</Text>
                </View>

                {/* Trip Metrics Card */}
                <View style={styles.metricsCard}>
                    <View style={styles.metricsGrid}>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricLabel}>Tempo Est.</Text>
                            <View style={styles.metricValRow}>
                                <Text style={styles.metricValuePrimary}>{durationText}</Text>
                                <Text style={styles.metricValueUnit}>min</Text>
                            </View>
                        </View>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricLabel}>Distância</Text>
                            <View style={styles.metricValRow}>
                                <Text style={styles.metricValuePrimary}>{distanceText}</Text>
                                <Text style={styles.metricValueUnit}>km</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.trafficBadge}>
                        <Navigation size={14} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.trafficText}>Trânsito Moderado</Text>
                    </View>
                </View>

                {/* Passenger Card */}
                <View style={styles.passengerCard}>
                    <View style={styles.cardHeader}>
                        <View style={styles.passengerMeta}>
                            <View style={styles.avatarLargeBorder}>
                                <User size={28} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.passengerName}>{activeTrip.userName || activeTrip.clientName || 'Marco Silva'}</Text>
                                <Text style={styles.ratingText}>⭐ {activeTrip.userRating || 4.9} • {activeTrip.userTrips || '240 viagens'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.chatBtn} activeOpacity={0.8}>
                            <MessageSquare size={20} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.cardDivider} />

                    {/* Route Info */}
                    <View style={styles.routeDetails}>
                        <View style={styles.routeItem}>
                            <View style={styles.greenCircle} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.routeLabel}>Ponto de Partida</Text>
                                <Text style={styles.routeValue}>{activeTrip.pickupAddress || 'Endereço não disponível'}</Text>
                            </View>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeItem}>
                            <View style={styles.pinkPin} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.routeLabel}>Destino</Text>
                                <Text style={styles.routeValue}>{activeTrip.dropoffAddress || activeTrip.destAddress || 'Destino'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={{ flex: 1 }} />

                {/* Bottom Action buttons */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.mapBtn} onPress={onOpenMap} activeOpacity={0.8}>
                        <Map size={20} color={colors.text} style={{ marginRight: 8 }} />
                        <Text style={styles.mapBtnTxt}>ABRIR MAPA</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.startRideBtn} onPress={onStartRide} activeOpacity={0.9}>
                        <Text style={styles.startRideBtnTxt}>INICIAR CORRIDA</Text>
                        <Bolt size={20} color="#fff" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    // Top Bar
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

    // Main Canvas
    mainCanvas: { flex: 1, paddingHorizontal: 20, paddingTop: 16, pb: 40 },
    
    // Status
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
    pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    statusText: { fontSize: 13, fontWeight: '900', color: colors.primaryContainer, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Metrics Card
    metricsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 20,
    },
    metricsGrid: { flexDirection: 'row', width: '100%', divideStyle: 'solid' },
    metricItem: { flex: 1, alignItems: 'center', gap: 4 },
    metricLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    metricValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
    metricValuePrimary: { fontSize: 32, fontWeight: '800', color: colors.primary },
    metricValueUnit: { fontSize: 14, color: colors.text, fontWeight: '600' },
    trafficBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceContainerLow,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 16
    },
    trafficText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

    // Passenger Card
    passengerCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 4,
        borderColor: colors.primary,
        borderWidth: 1,
        borderTopColor: '#f1f1f5',
        borderRightColor: '#f1f1f5',
        borderBottomColor: '#f1f1f5',
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    passengerMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarLargeBorder: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: colors.surfaceContainerHighest, justifyContent: 'center', alignItems: 'center' },
    passengerName: { fontSize: 16, fontWeight: '800', color: colors.text },
    ratingText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    chatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },
    cardDivider: { height: 1, backgroundColor: colors.surfaceContainer, marginVertical: 14 },

    // Route Info
    routeDetails: { position: 'relative', gap: 12, paddingLeft: 6 },
    routeItem: { flexDirection: 'row', gap: 12 },
    greenCircle: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, backgroundColor: '#fff', marginTop: 4 },
    pinkPin: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 4 },
    routeLine: { width: 2, height: 24, backgroundColor: colors.outlineVariant, marginLeft: 5, position: 'absolute', top: 16 },
    routeLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    routeValue: { fontSize: 14, fontWeight: '750', color: colors.text, marginTop: 2 },

    // Bottom Actions
    actionsContainer: { gap: 12, paddingBottom: 24 },
    mapBtn: {
        width: '100%', height: 56, borderRadius: 12, borderWidth: 2, borderColor: colors.text,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff'
    },
    mapBtnTxt: { fontSize: 15, fontWeight: '900', color: colors.text },
    startRideBtn: {
        width: '100%', height: 60, borderRadius: 12, backgroundColor: colors.primary,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6
    },
    startRideBtnTxt: { fontSize: 16, fontWeight: '900', color: '#fff' },
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
