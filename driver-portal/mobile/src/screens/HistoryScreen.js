import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { Clock, MapPin, DollarSign, Calendar, FileText, X } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import colors from '../theme/colors';
import { formatCurrency, formatDate } from '../utils/formatters';


export default function HistoryScreen() {
    const { user } = useContext(AuthContext);
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [filter, setFilter] = useState('all');
    const [monthlyStats, setMonthlyStats] = useState({ count: 0, total: 0 });

    const monthlyGoal = 150000;
    const goalPercent = Math.min(Math.round((monthlyStats.total / monthlyGoal) * 100), 100);


    useEffect(() => {
        fetchHistory();
        fetchMonthlyStats();
    }, [filter]);

    const fetchMonthlyStats = async () => {
        if (!user) return;
        try {
            const res = await api.get(`/trips/stats/monthly/${user.id}?role=driver`);
            if (res.data) setMonthlyStats(res.data);
        } catch (e) {
            console.error('Error fetching monthly stats:', e);
        }
    };


    const fetchHistory = async () => {
        if (!user) return;
        try {
            const res = await api.get(`/trips/history/${user.id}?role=driver&status=${filter}`);
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
    };


    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
            case 'paid':
                return colors.success;
            case 'cancelled':
                return colors.error || '#ef4444';
            case 'ongoing':
            case 'accepted':
            case 'finished':
                return colors.primary;
            default:
                return colors.textSecondary;
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'requested': return 'Pendente';
            case 'accepted': return 'Em Trânsito';
            case 'ongoing': return 'Em Curso';
            case 'finished': return 'Finalizada';
            case 'paid': return 'Paga';
            case 'completed': return 'Concluída';
            case 'cancelled': return 'Cancelada';
            default: return status.toUpperCase();
        }
    };

    const renderTrip = ({ item, index }) => (
        <Animated.View
            entering={FadeInUp.delay(index * 100)}
            style={styles.tripCard}>
            <View style={styles.tripHeader}>
                <View style={styles.tripDate}>
                    <Calendar size={16} color={colors.textSecondary} />
                    <Text style={styles.tripDateText}>{formatDate(item.created_at)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {getStatusText(item.status)}
                    </Text>
                </View>
            </View>

            <View style={styles.tripRoute}>
                <View style={styles.routePoint}>
                    <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                    <View style={styles.routeInfo}>
                        <Text style={styles.routeLabel}>Origem</Text>
                        <Text style={styles.routeAddress} numberOfLines={1}>
                            {item.pickupAddress || 'Endereço não disponível'}
                        </Text>
                    </View>
                </View>

                <View style={styles.routeLine} />

                <View style={styles.routePoint}>
                    <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
                    <View style={styles.routeInfo}>
                        <Text style={styles.routeLabel}>Destino</Text>
                        <Text style={styles.routeAddress} numberOfLines={1}>
                            {item.destAddress || 'Endereço não disponível'}
                        </Text>
                    </View>
                </View>
            </View>


            <View style={styles.tripFooter}>
                <View style={styles.tripStat}>
                    <Clock size={16} color={colors.textSecondary} />
                    <Text style={styles.tripStatText}>
                        {item.duration ? `${Math.round(item.duration / 60)} min` : 'N/A'}
                    </Text>
                </View>
                <View style={styles.tripStat}>
                    <MapPin size={16} color={colors.textSecondary} />
                    <Text style={styles.tripStatText}>
                        {item.distance ? `${(item.distance / 1000).toFixed(1)} km` : 'N/A'}
                    </Text>
                </View>
                <View style={styles.tripPrice}>
                    <DollarSign size={18} color={colors.success} />
                    <Text style={styles.tripPriceText}>
                        {formatCurrency(item.price || 0)}
                    </Text>
                    {item.status === 'completed' && (
                        <TouchableOpacity
                            style={styles.receiptBtn}
                            onPress={() => setSelectedTrip(item)}
                        >
                            <FileText size={20} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Animated.View>
    );

    if (loading) {
        return (
            <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Carregando histórico...</Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.title}>Meus Ganhos</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <LinearGradient colors={colors.gradients.pink} style={styles.statGradient}>
                                <Text style={styles.statLabel}>Mês Atual</Text>
                                <Text style={styles.statValue}>{formatCurrency(monthlyStats.total)}</Text>
                                <DollarSign size={24} color="#fff" style={styles.statIcon} />
                            </LinearGradient>
                        </View>
                        <View style={styles.statCard}>
                            <LinearGradient colors={colors.gradients.blue} style={styles.statGradient}>
                                <Text style={styles.statLabel}>Viagens</Text>
                                <Text style={styles.statValue}>{monthlyStats.count}</Text>
                                <Clock size={24} color="#fff" style={styles.statIcon} />
                            </LinearGradient>
                        </View>
                    </View>

                    {/* Monthly Goal Meter */}
                    <View style={styles.goalCard}>
                        <View style={styles.goalHeader}>
                            <Text style={styles.goalTitle}>META DO MÊS</Text>
                            <Text style={styles.goalPercent}>{goalPercent}%</Text>
                        </View>
                        <View style={styles.goalBarBase}>
                            <Animated.View style={[styles.goalBarFill, { width: `${goalPercent}%` }]} />
                        </View>
                        <Text style={styles.goalText}>Faltam {formatCurrency(Math.max(0, monthlyGoal - monthlyStats.total))} para bater sua meta!</Text>
                    </View>

                    {/* Filter Chips */}
                    <View style={styles.filterContainer}>
                        {[
                            { id: 'all', label: 'Todas' },
                            { id: 'completed', label: 'Concluídas' },
                            { id: 'cancelled', label: 'Canceladas' }
                        ].map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.filterChip, filter === item.id && styles.filterChipActive]}
                                onPress={() => setFilter(item.id)}
                            >
                                <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <FlatList
                    data={trips}
                    renderItem={renderTrip}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MapPin size={64} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>Nenhuma corrida realizada ainda</Text>
                            <Text style={styles.emptySubtext}>
                                Suas corridas aparecerão aqui após serem concluídas.
                            </Text>
                        </View>
                    }
                />

                {selectedTrip && (
                    <View style={styles.modalOverlay}>
                        <Animated.View entering={FadeInUp} style={styles.receiptModal}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Recibo de Corrida</Text>
                                <TouchableOpacity onPress={() => setSelectedTrip(null)}>
                                    <X size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.receiptContent}>
                                <View style={styles.receiptRow}>
                                    <Text style={styles.receiptLabel}>ID da Corrida</Text>
                                    <Text style={styles.receiptValue}>#{selectedTrip.id.substring(0, 8).toUpperCase()}</Text>
                                </View>
                                <View style={styles.receiptRow}>
                                    <Text style={styles.receiptLabel}>Cliente</Text>
                                    <Text style={styles.receiptValue}>{selectedTrip.userName || 'Cliente TOT'}</Text>
                                </View>


                                <View style={styles.receiptAddress}>
                                    <Text style={styles.receiptLabel}>Origem</Text>
                                    <Text style={styles.receiptValue}>{selectedTrip.pickupAddress || 'Endereço não disponível'}</Text>
                                </View>

                                <View style={styles.receiptAddress}>
                                    <Text style={styles.receiptLabel}>Destino</Text>
                                    <Text style={styles.receiptValue}>{selectedTrip.destAddress || 'Destino não especificado'}</Text>
                                </View>


                                <View style={styles.receiptDivider} />

                                <View style={styles.receiptTotalRow}>
                                    <Text style={styles.receiptTotalLabel}>Valor Total</Text>
                                    <Text style={styles.receiptTotalValue}>{formatCurrency(selectedTrip.price)}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.closeModalBtn}
                                onPress={() => setSelectedTrip(null)}
                            >
                                <Text style={styles.closeModalText}>FECHAR</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        padding: 20,
        backgroundColor: colors.surface,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 20,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 5,
    },
    statGradient: {
        padding: 20,
        justifyContent: 'center',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
    },
    statValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
        marginTop: 4,
    },
    statIcon: {
        position: 'absolute',
        right: 15,
        bottom: 15,
        opacity: 0.3,
    },
    goalCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    goalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    goalTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    goalPercent: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '900',
    },
    goalBarBase: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    goalBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 3,
    },
    goalText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        marginTop: 8,
        textAlign: 'center',
    },
    filterContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    filterTextActive: {
        color: '#fff',
    },
    listContent: {
        padding: 20,
        paddingTop: 0,
    },
    tripCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    tripDate: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tripDateText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    tripRoute: {
        marginBottom: 16,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    routeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 4,
        marginRight: 12,
    },
    routeLine: {
        width: 2,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginLeft: 5,
        marginVertical: 4,
    },
    routeInfo: {
        flex: 1,
    },
    routeLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    routeAddress: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '500',
    },
    tripFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    tripStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginRight: 16,
    },
    tripStatText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    tripPrice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 'auto',
    },
    tripPriceText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.success,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.textSecondary,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 64,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    receiptBtn: {
        marginLeft: 12,
        padding: 4,
        backgroundColor: 'rgba(233, 30, 99, 0.1)',
        borderRadius: 8,
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 1000,
    },
    receiptModal: {
        backgroundColor: colors.surface,
        width: '100%',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    receiptContent: {
        gap: 16,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    receiptLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    receiptValue: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
    },
    receiptAddress: {
        gap: 4,
    },
    receiptDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 4,
    },
    receiptTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    receiptTotalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    receiptTotalValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.success,
    },
    closeModalBtn: {
        marginTop: 32,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    closeModalText: {
        color: '#fff',
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});
