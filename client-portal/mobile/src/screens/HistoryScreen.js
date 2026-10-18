import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar,
    Dimensions,
    ScrollView,
    Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';
import { ArrowLeft, Clock, MapPin, ChevronRight, Info, Calendar, Menu, Search, Navigation, Banknote, Download, X } from 'lucide-react-native';
import api from '../services/api';
import { shareOperationalReceipt } from '../services/operationalReceiptExporter';
import { toSafeErrorLog } from '../utils/safeErrorLog';
import { canGenerateOperationalReceipt, getReceiptPaymentSummary, getReceiptTitle } from '../utils/receiptSummary';

const { width } = Dimensions.get('window');

export default function HistoryScreen({ navigation }) {
    const { user } = useAuth();
    const [trips, setTrips] = useState([]);
    const [status, setStatus] = useState({ loading: true, loadingMore: false, error: false, errorPage: 1 });
    const [query, setQuery] = useState({ filter: 'all', page: 1, hasMore: true });
    const [receiptTrip, setReceiptTrip] = useState(null);
    const [receiptExporting, setReceiptExporting] = useState(false);
    const receiptSummary = getReceiptPaymentSummary(receiptTrip);
    const requestIdRef = useRef(0);
    const activeRequestRef = useRef(null);
    const receiptExportLockRef = useRef(false);

    const handleExportReceipt = async () => {
        if (!receiptTrip || receiptExportLockRef.current) return;
        receiptExportLockRef.current = true;
        setReceiptExporting(true);
        try {
            const response = await api.get(`/trips/${receiptTrip.id}`);
            const latestTrip = response?.data;
            if (!latestTrip || latestTrip.id !== receiptTrip.id) {
                throw new Error('Não foi possível confirmar o estado da viagem no servidor.');
            }
            if (!canGenerateOperationalReceipt(latestTrip)) {
                Alert.alert('Pagamento ainda não confirmado', 'O recibo ficará disponível depois de o pagamento ser confirmado pelo servidor.');
                return;
            }
            await shareOperationalReceipt(latestTrip);
        } catch (error) {
            console.error('Erro ao preparar recibo operacional:', toSafeErrorLog(error));
            Alert.alert('Não foi possível preparar o recibo', 'Tente novamente.');
        } finally {
            receiptExportLockRef.current = false;
            setReceiptExporting(false);
        }
    };

    useEffect(() => {
        setTrips([]);
        setQuery(prev => ({ ...prev, page: 1, hasMore: true }));
        fetchHistory(1, true, query.filter);
    }, [query.filter]);

    useEffect(() => () => {
        requestIdRef.current += 1;
        activeRequestRef.current = null;
    }, []);

    const fetchHistory = async (pageNumber = 1, isInitial = false, filter = query.filter, isRetry = false) => {
        if (!query.hasMore && !isInitial) return;
        if (!isInitial && status.error && status.errorPage === pageNumber && !isRetry) return;
        if (!isInitial && activeRequestRef.current) return;

        const requestId = ++requestIdRef.current;
        activeRequestRef.current = requestId;

        try {
            if (isInitial) setStatus(prev => ({ ...prev, loading: true, error: false }));
            else setStatus(prev => ({ ...prev, loadingMore: true, error: false }));

            const res = await api.get(`/trips/history/${user.id}`, {
                params: {
                    status: filter,
                    role: 'client',
                    page: pageNumber,
                    limit: 15
                }
            });

            if (!Array.isArray(res.data) || res.data.some((trip) => (
                !trip || typeof trip !== 'object' || Array.isArray(trip) ||
                typeof trip.id !== 'string' || trip.id.trim() === ''
            ))) throw new Error('Resposta inválida do histórico')

            if (requestId !== requestIdRef.current) return;
            const newTrips = res.data;
            if (newTrips.length < 15) {
                setQuery(prev => ({ ...prev, hasMore: false }));
            }
            setQuery(prev => ({ ...prev, page: pageNumber }));

            if (isInitial) {
                setTrips(newTrips);
            } else {
                setTrips(prev => [...prev, ...newTrips]);
            }
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            console.error('Error fetching history:', toSafeErrorLog(error));
            setStatus(prev => ({ ...prev, error: true, errorPage: pageNumber }));
        } finally {
            if (requestId === requestIdRef.current) {
                activeRequestRef.current = null;
                setStatus(prev => ({ ...prev, loading: false, loadingMore: false }));
            }
        }
    };

    const handleLoadMore = () => {
        if (!status.loading && !status.loadingMore && !status.error && query.hasMore && !activeRequestRef.current) {
            const nextPage = query.page + 1;
            fetchHistory(nextPage);
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
                        <Text style={styles.receiptBtnText}>Resumo</Text>
                        <ChevronRight size={14} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderHeaderContent = () => (
        <View style={styles.headerContentContainer}>
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
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <ArrowLeft size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>HISTÓRICO</Text>
                {/* Spacer for centering */}
                <View style={{ width: 44 }} />
            </View>

            {(status.loading && (trips?.length || 0) === 0) ? (
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
                        ) : status.error && trips.length > 0 ? (
                            <TouchableOpacity style={{ padding: 16, alignItems: 'center' }} onPress={() => fetchHistory(status.errorPage, false, query.filter, true)}>
                                <Text style={{ color: colors.primary, fontWeight: '700' }}>Falha ao carregar mais. Tentar novamente</Text>
                            </TouchableOpacity>
                        ) : <View style={{ height: 20 }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconBox}>
                                <Clock size={40} color={colors.primary} strokeWidth={1} />
                            </View>
                            <Text style={styles.emptyTitle}>{status.error ? 'Falha ao carregar' : 'Sem registros'}</Text>
                            <Text style={styles.emptyText}>{status.error ? 'Verifique a ligação e tente novamente.' : 'Não encontramos viagens com este filtro.'}</Text>
                            {status.error && <TouchableOpacity onPress={() => fetchHistory(status.errorPage, true)} style={{ marginTop: 12, padding: 12 }}><Text style={{ color: colors.primary, fontWeight: '700' }}>Tentar novamente</Text></TouchableOpacity>}
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
                            <Text style={styles.receiptHeaderText}>{getReceiptTitle(receiptTrip)}</Text>
                            <TouchableOpacity style={styles.closeReceipt} onPress={() => setReceiptTrip(null)}>
                                <X size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.receiptContent} showsVerticalScrollIndicator={false}>
                            <Text style={styles.receiptDisclaimer}>
                                {canGenerateOperationalReceipt(receiptTrip)
                                    ? 'Documento operacional · não fiscal'
                                    : 'O recibo fica disponível após a confirmação do pagamento pelo servidor.'}
                            </Text>
                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>ID DA VIAGEM</Text>
                                <Text style={styles.receiptValue}>#TOT-{receiptTrip?.id?.substring(0, 8)?.toUpperCase() || '---'}</Text>
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
                                <Text style={styles.receiptLabel}>VALOR REGISTADO</Text>
                                <View style={styles.fareRow}>
                                    <Text style={styles.totalLabel}>{receiptSummary.amountLabel}</Text>
                                    <Text style={styles.totalVal}>Kz {receiptSummary.amount.toLocaleString()}</Text>
                                </View>
                            </View>

                            <View style={styles.receiptDivider} />

                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>MÉTODO E ESTADO DO PAGAMENTO</Text>
                                <View style={styles.paymentMethodRow}>
                                    <Banknote size={18} color={colors.primary} />
                                    <Text style={styles.paymentMethodText}>{receiptSummary.paymentLabel}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.downloadBtn, receiptExporting && styles.downloadBtnDisabled]}
                                onPress={handleExportReceipt}
                                disabled={receiptExporting}
                                accessibilityRole="button"
                                accessibilityLabel="Guardar recibo operacional"
                            >
                                {receiptExporting
                                    ? <ActivityIndicator color={colors.primary} />
                                    : <Download size={18} color={colors.primary} />}
                                <Text style={styles.downloadBtnText}>
                                    {receiptExporting ? 'A preparar recibo…' : 'Guardar'}
                                </Text>
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
        height: 60,
        backgroundColor: colors.primary,
        ...colors.shadow,
        zIndex: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: 2,
        flex: 1,
        textAlign: 'center',
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
        backgroundColor: '#FDF2F5',
        borderRadius: 28,
        padding: 20,
        marginBottom: 20,
        marginHorizontal: 24,
        borderWidth: 0.8,
        borderColor: 'rgba(233, 30, 99, 0.15)',
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
        backgroundColor: '#FFF', // Contrast within the tonal card
        padding: 15,
        borderRadius: 20,
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
    receiptDisclaimer: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 18,
        textAlign: 'center',
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
        flexDirection: 'row',
        gap: 10,
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
    downloadBtnDisabled: {
        opacity: 0.65,
    },
    downloadBtnText: {
        color: colors.text,
        fontWeight: '800',
        fontSize: 14,
    },
});
