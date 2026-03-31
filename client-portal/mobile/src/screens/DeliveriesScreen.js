import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Modal,
    ScrollView
} from 'react-native';
import {
    ArrowLeft,
    Package,
    Clock,
    MapPin,
    ChevronRight,
    User,
    CheckCircle,
    XCircle,
    Truck,
    Calendar,
    CreditCard,
    X
} from 'lucide-react-native';
import colors from '../theme/colors';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';

export default function DeliveriesScreen({ navigation }) {
    const { user } = useAuth();
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [receiptDelivery, setReceiptDelivery] = useState(null);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        loadDeliveries();
    }, [filter]);

    const loadDeliveries = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/trips/history/${user.id}`, {
                params: {
                    limit: 50,
                    category: 'delivery',
                    status: filter === 'all' ? undefined : filter
                }
            });
            setDeliveries(response.data);
        } catch (error) {
            console.error('Error loading deliveries:', error);
            Toast.show({ type: 'error', text1: 'Erro', text2: 'Não foi possível carregar as entregas' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadDeliveries();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'requested': return '#F59E0B'; // Amber
            case 'accepted': return '#3B82F6'; // Blue
            case 'ongoing': return colors.primary; // Pink
            case 'completed': return colors.success; // Green
            case 'cancelled': return colors.error; // Red
            default: return colors.textSecondary;
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'requested': return 'Aguardando Motorista';
            case 'accepted': return 'Motorista a caminho';
            case 'ongoing': return 'Em Trânsito';
            case 'waiting_payment': return 'Aguardando Pagamento';
            case 'completed': return 'Entregue';
            case 'cancelled': return 'Cancelada';
            default: return status;
        }
    };

    const renderItem = ({ item }) => {
        const info = item.delivery_info || {};
        return (
            <TouchableOpacity
                style={styles.deliveryCard}
                onPress={() => {
                    if (['requested', 'accepted', 'ongoing', 'waiting_payment'].includes(item.status)) {
                        Toast.show({ type: 'info', text1: 'Rastreando', text2: 'Abrindo acompanhamento em tempo real...' });
                        navigation.navigate('DeliveryFlow', { tripId: item.id });
                    }
                }}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
                    </View>
                    <Text style={styles.priceText}>{item.estimated_fare?.toLocaleString()} Kz</Text>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.pathGraphic}>
                        <View style={styles.dotStart} />
                        <View style={styles.line} />
                        <MapPin size={14} color={colors.primary} />
                    </View>
                    <View style={styles.addresses}>
                        <Text style={styles.addressText} numberOfLines={1}>{item.origin_address}</Text>
                        <Text style={styles.addressTextDest} numberOfLines={1}>{item.dest_address}</Text>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} color={colors.textMuted} />
                        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text>
                    </View>
                    {/* Spacer to push button to the extreme right */}
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        style={styles.receiptBtn}
                        onPress={() => setReceiptDelivery(item)}
                    >
                        <Text style={styles.receiptBtnText}>Recibo</Text>
                        <ChevronRight size={14} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const renderHeader = () => (
        <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Suas Atividades</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
                {['all', 'completed', 'cancelled'].map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterChip, filter === f && styles.filterChipActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                            {f === 'all' ? 'Todas' : f === 'completed' ? 'Concluídas' : 'Canceladas'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Minhas Entregas</Text>
                <View style={{ width: 44 }} />
            </View>

            {loading && !refreshing ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={deliveries}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    ListHeaderComponent={renderHeader}
                    stickyHeaderIndices={[0]}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Package size={64} color={colors.border} />
                            <Text style={styles.emptyTitle}>Nenhuma entrega encontrada</Text>
                            <Text style={styles.emptySub}>Suas solicitações de entrega aparecerão aqui</Text>
                            <TouchableOpacity style={styles.startBtn} onPress={() => navigation.navigate('Dashboard')}>
                                <Text style={styles.startBtnText}>Solicitar Entrega</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* Delivery Details Modal (Receipt Design) */}
            <Modal
                visible={!!receiptDelivery}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setReceiptDelivery(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.receiptCard}>
                        <View style={styles.receiptPinkHeader}>
                            <Text style={styles.receiptHeaderText}>DETALHES DA ENTREGA</Text>
                            <TouchableOpacity style={styles.closeReceipt} onPress={() => setReceiptDelivery(null)}>
                                <X size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.receiptContent} showsVerticalScrollIndicator={false}>
                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>ID DA ENTREGA</Text>
                                <Text style={styles.receiptValue}>#TOT-{receiptDelivery?.id?.substring(0, 8)?.toUpperCase() || '---'}</Text>
                            </View>

                            <View style={styles.receiptDivider} />

                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>DETALHES DA ROTA</Text>
                                <View style={styles.routeRow}>
                                    <View style={styles.routeDotBlue} />
                                    <Text style={styles.routeText}>{receiptDelivery?.origin_address}</Text>
                                </View>
                                <View style={styles.routeRow}>
                                    <View style={styles.routeDotPink} />
                                    <Text style={styles.routeText}>{receiptDelivery?.dest_address}</Text>
                                </View>
                            </View>

                            <View style={styles.receiptDivider} />

                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>DADOS DA ENCOMENDA</Text>
                                <View style={styles.infoRow}>
                                    <User size={16} color={colors.primary} />
                                    <View>
                                        <Text style={styles.infoLabel}>Destinatário</Text>
                                        <Text style={styles.infoValue}>{receiptDelivery?.delivery_info?.recipientName || 'N/A'}</Text>
                                    </View>
                                </View>
                                <View style={[styles.infoRow, { marginTop: 15 }]}>
                                    <Package size={16} color={colors.primary} />
                                    <View>
                                        <Text style={styles.infoLabel}>Pacote / Descrição</Text>
                                        <Text style={styles.infoValue}>{receiptDelivery?.delivery_info?.packageDescription || 'N/A'}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.receiptDivider} />

                            <View style={styles.receiptSection}>
                                <Text style={styles.receiptLabel}>PAGAMENTO</Text>
                                <View style={styles.fareRow}>
                                    <Text style={styles.fareLabel}>Preço Base</Text>
                                    <Text style={styles.fareVal}>Kz {(Number(receiptDelivery?.final_fare || receiptDelivery?.estimated_fare) * 0.8).toLocaleString()}</Text>
                                </View>
                                <View style={styles.fareRow}>
                                    <Text style={styles.fareLabel}>Taxas TOT</Text>
                                    <Text style={styles.fareVal}>Kz {(Number(receiptDelivery?.final_fare || receiptDelivery?.estimated_fare) * 0.2).toLocaleString()}</Text>
                                </View>
                                <View style={[styles.fareRow, { marginTop: 10 }]}>
                                    <Text style={styles.totalLabel}>Total Pago</Text>
                                    <Text style={styles.totalVal}>Kz {Number(receiptDelivery?.final_fare || receiptDelivery?.estimated_fare).toLocaleString()}</Text>
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

                            <View style={{ height: 20 }} />
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
        backgroundColor: '#F8FAFC',
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
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
        paddingTop: 15,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '950',
        color: '#FFF',
        flex: 1,
        textAlign: 'center',
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    deliveryCard: {
        backgroundColor: '#FDF2F5', // Tonal Pink surface
        borderRadius: 28,
        padding: 20,
        marginBottom: 15,
        borderWidth: 0.8,
        borderColor: 'rgba(233, 30, 99, 0.15)', // Super-thin pink border
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    cardBody: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#FFF',
        padding: 15,
        borderRadius: 20,
        borderWidth: 0.5,
        borderColor: '#F1F5F9',
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
        backgroundColor: colors.textSecondary,
    },
    line: {
        width: 1.5,
        flex: 1,
        backgroundColor: 'rgba(233, 30, 99, 0.1)',
        marginVertical: 4,
    },
    addresses: {
        flex: 1,
        justifyContent: 'space-between',
        height: 45,
    },
    addressText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    addressTextDest: {
        fontSize: 13,
        color: colors.text,
        fontWeight: '800',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 15,
    },
    deliveryDetails: {
        flexDirection: 'row',
        gap: 20,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    detailText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
        paddingTop: 15,
    },
    dateText: {
        fontSize: 11,
        color: colors.textMuted,
        fontWeight: '600',
    },
    centerBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyBox: {
        marginTop: 100,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
        marginTop: 20,
    },
    emptySub: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 10,
        fontWeight: '600',
    },
    startBtn: {
        marginTop: 30,
        backgroundColor: colors.primary,
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 20,
        ...colors.shadow,
    },
    startBtnText: {
        color: '#FFF',
        fontWeight: '900',
        fontSize: 15,
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
        borderRadius: 28,
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
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1.5,
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
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    infoLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
    },
    filterSection: {
        backgroundColor: '#F8FAFC',
        paddingTop: 10,
        paddingBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 15,
        letterSpacing: 0.5,
    },
    filterBar: {
        flexDirection: 'row',
    },
    filterChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#FFF',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.textSecondary,
    },
    filterTextActive: {
        color: '#FFF',
    },
});
