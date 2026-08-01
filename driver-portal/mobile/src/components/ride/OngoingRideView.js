import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, Platform } from 'react-native';
import colors from '../../theme/colors';
import { User, Bell, MessageSquare, Phone, Map, Coins } from 'lucide-react-native';
import { formatCurrency } from '../../utils/formatters';

export default function OngoingRideView({ user, activeTrip, onOpenMap, onFinishRide }) {
    if (!activeTrip) return null;

    const distanceText = activeTrip.distance
        ? `${parseFloat(activeTrip.distance).toFixed(1)} km`
        : '4.2 km';

    const durationText = activeTrip.duration
        ? `${Math.round(activeTrip.duration / 60)} min`
        : '12 min';

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
                    <Text style={styles.statusText}>Em Viagem</Text>
                </View>

                {/* Prominent Trip Details Card */}
                <View style={styles.detailsCard}>
                    <Text style={styles.cardSectionLabel}>Destino</Text>
                    <Text style={styles.destinationTitle} numberOfLines={2}>
                        {activeTrip.dropoffAddress || activeTrip.destAddress || 'Estrely Park'}
                    </Text>

                    <View style={styles.metricsGrid}>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricLabel}>Chegada</Text>
                            <Text style={styles.metricValue}>{durationText}</Text>
                        </View>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricLabel}>Distância</Text>
                            <Text style={styles.metricValue}>{distanceText}</Text>
                        </View>
                    </View>
                </View>

                {/* Bento Layout Info Cards */}
                <View style={styles.bentoContainer}>
                    {/* Passenger Info Card */}
                    <View style={styles.passengerCard}>
                        <View style={styles.passengerMeta}>
                            <View style={styles.avatarBorder}>
                                <User size={24} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.passengerName}>{activeTrip.userName || activeTrip.clientName || 'Marco Silva'}</Text>
                                <Text style={styles.ratingText}>⭐ {activeTrip.userRating || 4.9} • {activeTrip.userType || 'Passageiro VIP'}</Text>
                            </View>
                        </View>
                        <View style={styles.actionBtns}>
                            <TouchableOpacity style={styles.roundActionBtn} activeOpacity={0.8}>
                                <MessageSquare size={18} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.roundActionBtn} activeOpacity={0.8}>
                                <Phone size={18} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Value + Payment Method Cards (Grid Row) */}
                    <View style={styles.gridRow}>
                        {/* Value card */}
                        <View style={styles.gridCard}>
                            <Text style={styles.gridCardLabel}>Valor Estimado</Text>
                            <Text style={styles.gridCardValue}>{formatCurrency(activeTrip.price || 0)}</Text>
                        </View>
                        {/* Payment card */}
                        <View style={styles.gridCard}>
                            <Text style={styles.gridCardLabel}>Pagamento</Text>
                            <View style={styles.paymentRow}>
                                <Coins size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                                <Text style={styles.paymentMethodText}>{activeTrip.paymentMethod || 'Dinheiro'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={{ flex: 1 }} />

                {/* Bottom Actions */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.mapBtn} onPress={onOpenMap} activeOpacity={0.8}>
                        <Map size={20} color={colors.text} style={{ marginRight: 8 }} />
                        <Text style={styles.mapBtnTxt}>ABRIR MAPA</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.finishBtn} onPress={onFinishRide} activeOpacity={0.9}>
                        <Text style={styles.finishBtnTxt}>FINALIZAR CORRIDA</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const topBarStyles = StyleSheet.create({
    topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarMiniBorder: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.primary, overflow: 'hidden' },
    avatarMini: { width: '100%', height: '100%', objectFit: 'cover' },
    logoText: { fontSize: 20, fontWeight: '900', color: colors.primary, letterSpacing: -1 },
    notifyBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },
});

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

    // Main Canvas
    mainCanvas: { flex: 1, paddingHorizontal: 20, paddingTop: 16, pb: 40 },

    // Status
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
    pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    statusText: { fontSize: 13, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Details Card
    detailsCard: {
        backgroundColor: 'rgba(227, 0, 113, 0.05)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(227, 0, 113, 0.1)',
        marginBottom: 20,
    },
    cardSectionLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    destinationTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4, marginBottom: 16 },
    metricsGrid: { flexDirection: 'row' },
    metricItem: { flex: 1 },
    metricLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    metricValue: { fontSize: 26, fontWeight: '800', color: colors.primary, marginTop: 4 },

    // Bento Info Cards
    bentoContainer: { gap: 16 },
    passengerCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f1f5',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    passengerMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarBorder: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.surfaceContainerHighest, justifyContent: 'center', alignItems: 'center' },
    passengerName: { fontSize: 15, fontWeight: '800', color: colors.text },
    ratingText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    actionBtns: { flexDirection: 'row', gap: 8 },
    roundActionBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },

    gridRow: { flexDirection: 'row', gap: 12 },
    gridCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f1f5',
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        justifyContent: 'center'
    },
    gridCardLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    gridCardValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
    paymentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    paymentMethodText: { fontSize: 15, fontWeight: '750', color: colors.text },

    // Bottom Actions
    actionsContainer: { gap: 12, paddingBottom: 24 },
    mapBtn: {
        width: '100%', height: 56, borderRadius: 12, borderWidth: 2, borderColor: colors.text,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff'
    },
    mapBtnTxt: { fontSize: 15, fontWeight: '900', color: colors.text },
    finishBtn: {
        width: '100%', height: 64, borderRadius: 12, backgroundColor: colors.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6
    },
    finishBtnTxt: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
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
