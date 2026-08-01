import React, { useState, useEffect, useContext } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    RefreshControl, TouchableOpacity, StatusBar, Image, Platform
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { 
    Coins, Wallet, TrendingUp, History, Bell, Navigation, 
    ArrowRight, MapPin, Calendar, Clock
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import colors from '../theme/colors';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function HistoryScreen() {
    const { user } = useContext(AuthContext);
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ rides: 0, earnings: 0 });

    useEffect(() => {
        fetchHistory();
        fetchStats();
    }, []);

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
            console.error('Error fetching history stats:', e);
        }
    };

    const fetchHistory = async () => {
        if (!user) return;
        try {
            const res = await api.get(`/trips/history/${user.id}?role=driver&status=all`);
            setTrips(res.data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
            Toast.show({
                type: 'error',
                text1: 'Erro ao carregar histórico',
                text2: 'Tente novamente mais tarde.'
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
        fetchStats();
    };

    const renderTripItem = ({ item }) => {
        return (
            <View style={styles.glassCard}>
                <View style={styles.cardLeft}>
                    <View style={styles.bikeIconBg}>
                        <Navigation size={18} color={colors.text} style={{ transform: [{ rotate: '45deg' }] }} />
                    </View>
                    <View style={styles.tripMeta}>
                        <Text style={styles.routeHeadline} numberOfLines={1}>
                            {item.pickupAddress?.split(',')[0]} ➔ {item.destAddress?.split(',')[0] || 'Destino'}
                        </Text>
                        <Text style={styles.tripTime}>{formatDate(item.created_at)}</Text>
                    </View>
                </View>
                <View style={styles.cardRight}>
                    <Text style={styles.tripEarnings}>+ {formatCurrency(item.price || 0)}</Text>
                    <Text style={styles.tripStatusText}>Concluída</Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

            {/* ─── TOP APP BAR ─── */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <View style={styles.headerAvatarBorder}>
                        {user?.avatar_url ? (
                            <Image source={{ uri: user.avatar_url }} style={styles.headerAvatar} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarFallbackText}>
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
            <FlatList
                data={trips}
                renderItem={renderTripItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.scrollCanvas}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
                ListHeaderComponent={
                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.pageTitle}>Meus Ganhos</Text>

                        {/* Balance Card */}
                        <View style={styles.balanceCard}>
                            <View style={styles.balanceInfo}>
                                <View>
                                    <Text style={styles.balanceLabel}>Saldo Atual</Text>
                                    <Text style={styles.balanceValue}>{formatCurrency(stats.earnings)}</Text>
                                </View>
                                <Wallet size={32} color={colors.primaryContainer} />
                            </View>
                            <View style={styles.balanceActions}>
                                <TouchableOpacity style={styles.withdrawBtn} activeOpacity={0.9}>
                                    <Coins size={18} color="#fff" style={{ marginRight: 6 }} />
                                    <Text style={styles.withdrawBtnTxt}>Saque</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.detailsBtn} activeOpacity={0.8}>
                                    <Text style={styles.detailsBtnTxt}>Detalhes</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Weekly Chart Card */}
                        <View style={styles.chartCard}>
                            <View style={styles.chartHeader}>
                                <Text style={styles.chartTitle}>Esta Semana</Text>
                                <Text style={styles.chartTotalText}>{formatCurrency(stats.earnings)} total</Text>
                            </View>
                            
                            <View style={styles.chartGrid}>
                                {[
                                    { day: 'Seg', val: 45, isToday: false },
                                    { day: 'Ter', val: 65, isToday: false },
                                    { day: 'Qua', val: 55, isToday: false },
                                    { day: 'Qui', val: 85, isToday: false },
                                    { day: 'Hoje', val: 100, isToday: true },
                                    { day: 'Sab', val: 10, isToday: false },
                                    { day: 'Dom', val: 10, isToday: false }
                                ].map((item, idx) => (
                                    <View key={idx} style={styles.chartColumn}>
                                        <View style={styles.barContainer}>
                                            <View 
                                                style={[
                                                    styles.chartBar, 
                                                    { height: `${item.val}%` },
                                                    item.isToday ? styles.chartBarActive : styles.chartBarInactive
                                                ]} 
                                            />
                                        </View>
                                        <Text style={[styles.dayText, item.isToday && styles.dayTextActive]}>
                                            {item.day}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Corridas Recentes</Text>
                            <TouchableOpacity activeOpacity={0.7}>
                                <Text style={styles.sectionLink}>Ver todas</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <History size={48} color={colors.textMuted} style={{ marginBottom: 12, opacity: 0.3 }} />
                        <Text style={styles.emptyTitle}>Nenhuma corrida concluída</Text>
                        <Text style={styles.emptySubtitle}>As corridas e ganhos concluídos aparecerão aqui.</Text>
                    </View>
                }
                ListFooterComponent={<View style={{ height: 100 }} />}
                showsVerticalScrollIndicator={false}
            />
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
    headerAvatarBorder: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.primary, overflow: 'hidden' },
    headerAvatar: { width: '100%', height: '100%', objectFit: 'cover' },
    logoText: { fontSize: 20, fontWeight: '900', color: colors.primary, letterSpacing: -1 },
    notifyBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },

    // Main Canvas
    scrollCanvas: { padding: 20 },
    pageTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16 },

    // Balance Card
    balanceCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        borderWidth: 1,
        borderColor: '#f1f1f5',
        shadowColor: '#1a1c1f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 20
    },
    balanceInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    balanceLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    balanceValue: { fontSize: 28, fontWeight: '900', color: colors.text, marginTop: 4, letterSpacing: -0.5 },
    balanceActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    withdrawBtn: {
        flex: 1, height: 48, borderRadius: 8, backgroundColor: colors.primary,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
    },
    withdrawBtnTxt: { fontSize: 14, fontWeight: '850', color: '#fff' },
    detailsBtn: {
        flex: 1, height: 48, borderRadius: 8, borderWidth: 2, borderColor: colors.text,
        justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff'
    },
    detailsBtnTxt: { fontSize: 14, fontWeight: '850', color: colors.text },

    // Weekly Chart Card
    chartCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.surfaceContainerHighest,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
        marginBottom: 24
    },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    chartTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    chartTotalText: { fontSize: 13, fontWeight: '750', color: colors.primary },
    chartGrid: { flexDirection: 'row', height: 160, alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 10 },
    chartColumn: { flex: 1, alignItems: 'center', gap: 8 },
    barContainer: { height: 110, width: 14, justifyContent: 'flex-end', backgroundColor: colors.surfaceContainerLow, borderRadius: 8, overflow: 'hidden' },
    chartBar: { width: '100%', borderRadius: 8 },
    chartBarActive: { backgroundColor: colors.primary },
    chartBarInactive: { backgroundColor: colors.primaryContainer, opacity: 0.4 },
    dayText: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' },
    dayTextActive: { color: colors.primary, fontWeight: '800' },

    // Recent section
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    sectionLink: { fontSize: 14, fontWeight: '750', color: colors.primary },

    // Recent items List (Glass Card styled)
    glassCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f1f5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
        marginBottom: 12
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bikeIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },
    tripMeta: { gap: 2 },
    routeHeadline: { fontSize: 14, fontWeight: '800', color: colors.text, maxWidth: 160 },
    tripTime: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
    cardRight: { alignItems: 'flex-end', gap: 2 },
    tripEarnings: { fontSize: 15, fontWeight: '900', color: colors.primary },
    tripStatusText: { fontSize: 11, color: colors.successContainer, fontWeight: '750' },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
    emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    avatarFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarFallbackText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900'
    },
});
