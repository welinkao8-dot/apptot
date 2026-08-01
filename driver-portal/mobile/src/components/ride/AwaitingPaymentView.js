import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, ActivityIndicator, Platform } from 'react-native';
import colors from '../../theme/colors';
import { User, Bell, CheckCircle, Hourglass, Coins } from 'lucide-react-native';
import { formatCurrency } from '../../utils/formatters';

export default function AwaitingPaymentView({ user, activeTrip, onConfirmPayment }) {
    const [loading, setLoading] = useState(false);

    if (!activeTrip) return null;

    const handleConfirm = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            onConfirmPayment();
        }, 1200);
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

            {/* ─── TOP APP BAR ─── */}
            <View style={styles.topBar}>
                <View style={topBarStyles.topBarLeft}>
                    <View style={topBarStyles.avatarMiniBorder}>
                        {user?.avatar_url ? (
                            <Image source={{ uri: user.avatar_url }} style={topBarStyles.avatarMini} />
                        ) : (
                            <View style={styles.avatarMiniFallback}>
                                <Text style={styles.avatarMiniFallbackText}>
                                    {user?.full_name?.[0]?.toUpperCase() || 'M'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={topBarStyles.logoText}>TOT</Text>
                </View>
                <TouchableOpacity style={topBarStyles.notifyBtn} activeOpacity={0.8}>
                    <Bell size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* ─── MAIN CONTENT ─── */}
            <View style={styles.mainCanvas}>
                {/* Status Indicator */}
                <View style={styles.statusSection}>
                    <View style={styles.statusPill}>
                        <Hourglass size={16} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.statusPillText}>Aguardando Pagamento</Text>
                    </View>
                </View>

                {/* Trip Summary Card */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Valor Total</Text>
                    <View style={styles.priceRow}>
                        <Text style={styles.currencySymbol}>Kz</Text>
                        <Text style={styles.priceValue}>{parseFloat(activeTrip.price || 0).toFixed(2)}</Text>
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.paymentMetaRow}>
                        <View style={styles.paymentMethodInfo}>
                            <View style={styles.methodIconBg}>
                                <Coins size={20} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.paymentLabel}>Método</Text>
                                <Text style={styles.paymentValue}>{activeTrip.paymentMethod || 'Dinheiro'}</Text>
                            </View>
                        </View>
                        <View style={styles.pingingDot} />
                    </View>
                </View>

                {/* Passenger Info Card */}
                <View style={styles.passengerCard}>
                    <View style={styles.avatarBorder}>
                        <User size={24} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.passengerLabel}>Passageiro</Text>
                        <Text style={styles.passengerName}>{activeTrip.userName || activeTrip.clientName || 'Marco Silva'}</Text>
                    </View>
                    <View style={styles.ratingBadge}>
                        <Text style={styles.ratingStar}>⭐</Text>
                        <Text style={styles.ratingValue}>{activeTrip.userRating || 4.9}</Text>
                    </View>
                </View>

                <View style={{ flex: 1 }} />

                {/* Instructions */}
                <View style={styles.instructionContainer}>
                    <Text style={styles.instructionText}>
                        Aguarde o passageiro realizar o pagamento antes de confirmar.
                    </Text>
                </View>

                {/* Confirmation Button */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity 
                        style={styles.confirmBtn} 
                        onPress={handleConfirm} 
                        disabled={loading}
                        activeOpacity={0.9}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <CheckCircle size={22} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.confirmBtnTxt}>CONFIRMAR RECEBIMENTO</Text>
                            </>
                        )}
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

    // Status Indicator
    statusSection: { alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryContainer,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4
    },
    statusPillText: { fontSize: 11, fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },

    // Summary Card
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f1f1f5',
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 16,
    },
    summaryLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
    currencySymbol: { fontSize: 24, fontWeight: '800', color: colors.primary, marginRight: 2 },
    priceValue: { fontSize: 44, fontWeight: '800', color: colors.primary, lineHeight: 48 },
    cardDivider: { height: 1, backgroundColor: colors.surfaceContainer, marginVertical: 16 },
    paymentMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paymentMethodInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    methodIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },
    paymentLabel: { fontSize: 11, color: colors.textSecondary },
    paymentValue: { fontSize: 16, fontWeight: '800', color: colors.text },
    pingingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

    // Passenger Info Card
    passengerCard: {
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.surfaceContainerHighest,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24
    },
    avatarBorder: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.surfaceContainerHighest, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    passengerLabel: { fontSize: 11, color: colors.textSecondary },
    passengerName: { fontSize: 15, fontWeight: '800', color: colors.text },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceContainerHighest, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    ratingStar: { fontSize: 12 },
    ratingValue: { fontSize: 13, fontWeight: '750', color: colors.text },

    // Instructions
    instructionContainer: { alignSelf: 'center', marginBottom: 24 },
    instructionText: { fontSize: 13, fontStyle: 'italic', color: colors.textSecondary, textAlign: 'center' },

    // Bottom Actions
    actionContainer: { paddingBottom: 24 },
    confirmBtn: {
        width: '100%', height: 60, borderRadius: 12, backgroundColor: colors.primary,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6
    },
    confirmBtnTxt: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
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
