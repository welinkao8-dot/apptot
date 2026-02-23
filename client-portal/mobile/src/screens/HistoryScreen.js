import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    Dimensions,
    ScrollView,
    Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';
import { ArrowLeft, Clock, MapPin, ChevronRight, Info, Calendar, Menu, Search, Navigation, CreditCard, X } from 'lucide-react-native';
import api from '../services/api';

const { width } = Dimensions.get('window');

export default function HistoryScreen({ navigation }) {
    const { user } = useAuth();
    const [trips, setTrips] = useState([]);
    const [stats, setStats] = useState({ count: 0, total: 0 });
    const [status, setStatus] = useState({ loading: true, loadingMore: false });
    const [query, setQuery] = useState({ filter: 'all', page: 1, hasMore: true });
    const [receiptTrip, setReceiptTrip] = useState(null);

    useEffect(() => {
        setTrips([]);
        setQuery(prev => ({ ...prev, page: 1, hasMore: true }));
        fetchHistory(1, true);
        fetchMonthlyStats();
    }, [query.filter]);

    const fetchHistory = async (pageNumber = 1, isInitial = false) => {
        if (!query.hasMore && !isInitial) return;

        try {
            if (isInitial) setStatus(prev => ({ ...prev, loading: true }));
            else setStatus(prev => ({ ...prev, loadingMore: true }));

            const res = await api.get(`/trips/history/${user.id}`, {
                params: {
                    status: query.filter,
                    role: 'client',
                    page: pageNumber,
                    limit: 15
                }
            });

            const newTrips = res.data;
            if (newTrips.length < 15) {
                setQuery(prev => ({ ...prev, hasMore: false }));
            }

            if (isInitial) {
                setTrips(newTrips);
            } else {
                setTrips(prev => [...prev, ...newTrips]);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setStatus(prev => ({ ...prev, loading: false, loadingMore: false }));
        }
    };

    const handleLoadMore = () => {
        if (!status.loading && !status.loadingMore && query.hasMore) {
            const nextPage = query.page + 1;
            setQuery(prev => ({ ...prev, page: nextPage }));
            fetchHistory(nextPage);
        }
    };

    const fetchMonthlyStats = async () => {
        try {
            const res = await api.get(`/trips/stats/monthly/${user.id}`, {
                params: { role: 'client' }
            });
            setStats(res.data);
        } catch (error) {
            console.error('Error fetching monthly stats:', error);
        }
    };

    const renderTripItem = ({ item }) => (
        <View style={styles.tripCard}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setReceiptTrip(item)}
            >
                <View style={styles.tripHeader}>
                    <View style={styles.dateRow}>
                        <Calendar size={14} color={colors.primary} />
                        <Text style={styles.dateText}>
                            {new Date(item.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: item.status === 'completed' ? '#FDF2F5' : '#F1F5F9' }]}>
                        <Text style={[styles.statusText, { color: item.status === 'completed' ? colors.primary : colors.textSecondary }]}>
                            {item.status === 'completed' ? 'Concluída' : 'Cancelada'}
                        </Text>
                    </View>
                </View>

                <View style={styles.tripBody}>
                    <View style={styles.pathGraphic}>
                        <View style={styles.dotStart} />
                        <View style={styles.line} />
                        <View style={styles.dotEnd} />
                    </View>
                    <View style={styles.addresses}>
                        <Text style={styles.addressText} numberOfLines={1}>{item.origin_address}</Text>
                        <Text style={styles.addressText} numberOfLines={1}>{item.dest_address}</Text>
                    </View>
                </View>

                <View style={styles.tripFooter}>
                    <View>
                        <Text style={styles.priceLabel}>Total</Text>
                        <Text style={styles.priceText}>Kz {Number(item.final_fare || item.estimated_fare).toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.receiptBtn}
                        onPress={() => {
                            setReceiptTrip(item);
                        }}
                    >
                        <Text style={styles.receiptBtnText}>Recibo</Text>
                        <ChevronRight size={14} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderHeaderContent = () => (
        <View style={styles.headerContentContainer}>
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <View style={[styles.statIconBox, { backgroundColor: '#FDF2F5' }]}>
                        <Navigation size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.statVal}>{stats.count}</Text>
                    <Text style={styles.statLabel}>Viagens/Mês</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                        <CreditCard size={22} color={colors.secondary} />
                    </View>
                    <Text style={styles.statVal}>Kz {Number(stats.total).toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Investimento</Text>
                </View>
            </View>

            <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>Suas Atividades</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
                    {['all', 'completed', 'cancelled'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, query.filter === f && styles.filterChipActive]}
                            onPress={() => setQuery(prev => ({ ...prev, filter: f }))}
                        >
                            <Text style={[styles.filterText, query.filter === f && styles.filterTextActive]}>
                                {f === 'all' ? 'Todas' : f === 'completed' ? 'Concluídas' : 'Canceladas'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.openDrawer()}>
                    <Menu size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>HISTÓRICO</Text>
                <TouchableOpacity style={styles.searchBtn}>
                    <Search size={20} color={colors.text} />
                </TouchableOpacity>
            </View>

            {status.loading && trips.length === 0 ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={trips}
                    renderItem={renderTripItem}
                    keyExtractor={item => item.id}
                    ListHeaderComponent={renderHeaderContent}
                    stickyHeaderIndices={[0]}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        status.loadingMore ? (
                            <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} />
                        ) : <View style={{ height: 20 }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconBox}>
                                <Clock size={40} color={colors.primary} strokeWidth={1} />
                            </View>
                            <Text style={styles.emptyTitle}>Sem registros</Text>
                            <Text style={styles.emptyText}>Não encontramos viagens com este filtro.</Text>
                        </View>
                    }
                />
            )}

            {/* Receipt Modal */}
            <Modal
                visible={!!receiptTrip}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setReceiptTrip(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.receiptCard}>
                        <View style={styles.receiptPinkHeader}>
                            <Text style={styles.receiptHeaderText}>RECIBO</Text>
                            <TouchableOpacity style={styles.closeReceipt} onPress={() => setReceiptTrip(null)}>
                                <X size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.receiptContent} showsVerticalScrollIndicator={false}>
                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>ID DA VIAGEM</Text>
                                <Text style={styles.receiptValue}>#TOT-{receiptTrip?.id?.substring(0, 8).toUpperCase()}</Text>
                            </View>

                            <View style={styles.receiptDivider} />

                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>DETALHES DA ROTA</Text>
                                <View style={styles.routeRow}>
                                    <View style={styles.routeDotBlue} />
                                    <Text style={styles.routeText}>{receiptTrip?.origin_address}</Text>
                                </View>
                                <View style={styles.routeRow}>
                                    <View style={styles.routeDotPink} />
                                    <Text style={styles.routeText}>{receiptTrip?.dest_address}</Text>
                                </View>
                            </View>

                            <View style={styles.receiptDivider} />

                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>RESUMO DO FILTRO</Text>
                                <View style={styles.fareRow}>
                                    <Text style={styles.fareLabel}>Preço Base</Text>
                                    <Text style={styles.fareVal}>Kz {(Number(receiptTrip?.final_fare || receiptTrip?.estimated_fare) * 0.8).toLocaleString()}</Text>
                                </View>
                                <View style={styles.fareRow}>
                                    <Text style={styles.fareLabel}>Taxas e Impostos</Text>
                                    <Text style={styles.fareVal}>Kz {(Number(receiptTrip?.final_fare || receiptTrip?.estimated_fare) * 0.2).toLocaleString()}</Text>
                                </View>
                                <View style={[styles.fareRow, { marginTop: 10 }]}>
                                    <Text style={styles.totalLabel}>Total Pago</Text>
                                    <Text style={styles.totalVal}>Kz {Number(receiptTrip?.final_fare || receiptTrip?.estimated_fare).toLocaleString()}</Text>
                                </View>
                            </View>

                            <View style={styles.receiptDivider} />

                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>MÉTODO DE PAGAMENTO</Text>
                                <View style={styles.paymentMethodRow}>
                                    <CreditCard size={18} color={colors.primary} />
                                    <Text style={styles.paymentMethodText}>Carteira TOT / Dinheiro</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.downloadBtn}
                                onPress={() => { }}
                            >
                                <Text style={styles.downloadBtnText}>Baixar Recibo (PDF)</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#FFF',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: colors.text,
        letterSpacing: 2,
    },
    searchBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingVertical: 10,
    },
    headerContentContainer: {
        backgroundColor: '#FFF',
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 20,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 30,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1.5,
        borderColor: '#F8FAFC',
        ...colors.shadow,
    },
    statIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statVal: {
        fontSize: 18,
        fontWeight: '950',
        color: colors.text,
    },
    statLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginTop: 4,
    },
    filterSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 15,
    },
    filterBar: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    filterChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        marginRight: 10,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    filterChipActive: {
        backgroundColor: '#FDF2F5',
        borderColor: colors.primary,
    },
    filterText: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.textSecondary,
    },
    filterTextActive: {
        color: colors.primary,
    },
    centerLoading: {
        paddingVertical: 100,
        alignItems: 'center',
    },
    tripCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        marginHorizontal: 24, // Fix shadow clipping by adding outer margin
        borderWidth: 1.5,
        borderColor: '#F8FAFC',
        elevation: 4, // Better shadow for Android
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
    },
    tripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dateText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    tripBody: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#FDF2F5',
        padding: 15,
        borderRadius: 16,
    },
    pathGraphic: {
        alignItems: 'center',
        marginRight: 15,
        paddingVertical: 5,
    },
    dotStart: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    dotEnd: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.text,
    },
    line: {
        width: 1.5,
        flex: 1,
        backgroundColor: 'rgba(233, 30, 99, 0.2)',
        marginVertical: 4,
    },
    addresses: {
        flex: 1,
        justifyContent: 'space-between',
        height: 45,
    },
    addressText: {
        fontSize: 13,
        color: colors.text,
        fontWeight: '700',
    },
    tripFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    priceText: {
        fontSize: 18,
        fontWeight: '950',
        color: colors.text,
    },
    detailsAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    detailsText: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '800',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 40,
        paddingHorizontal: 40,
    },
    emptyIconBox: {
        width: 80,
        height: 80,
        borderRadius: 30,
        backgroundColor: '#FDF2F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 8,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '500',
    },
    receiptBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FDF2F5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        gap: 4,
    },
    receiptBtnText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '800',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    receiptCard: {
        width: '100%',
        backgroundColor: '#FFF',
        borderRadius: 24,
        overflow: 'hidden',
        maxHeight: '80%',
    },
    receiptPinkHeader: {
        backgroundColor: colors.primary,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    receiptHeaderText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 2,
    },
    closeReceipt: {
        padding: 4,
    },
    receiptContent: {
        padding: 24,
    },
    receiptSection: {
        marginBottom: 20,
    },
    receiptLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 1,
    },
    receiptValue: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.text,
    },
    receiptDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 20,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    routeDotBlue: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3B82F6',
    },
    routeDotPink: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    routeText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '600',
        flex: 1,
    },
    fareRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    fareLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    fareVal: {
        fontSize: 13,
        color: colors.text,
        fontWeight: '700',
    },
    totalLabel: {
        fontSize: 15,
        color: colors.text,
        fontWeight: '900',
    },
    totalVal: {
        fontSize: 18,
        color: colors.primary,
        fontWeight: '900',
    },
    paymentMethodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    paymentMethodText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '700',
    },
    downloadBtn: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    downloadBtnText: {
        color: colors.text,
        fontWeight: '800',
        fontSize: 14,
    },
});
