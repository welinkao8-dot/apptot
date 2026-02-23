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
    RefreshControl
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
    Truck
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

    useEffect(() => {
        loadDeliveries();
    }, []);

    const loadDeliveries = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/trips/history/${user.id}`, {
                params: {
                    limit: 50,
                    category: 'delivery'
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
                    <View style={styles.addressRow}>
                        <View style={styles.dotLineBox}>
                            <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
                            <View style={styles.line} />
                            <MapPin size={16} color={colors.primary} />
                        </View>
                        <View style={styles.addressInfo}>
                            <Text style={styles.addressText} numberOfLines={1}>{item.origin_address}</Text>
                            <Text style={styles.addressTextDest} numberOfLines={1}>{item.dest_address}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.deliveryDetails}>
                        <View style={styles.detailItem}>
                            <User size={14} color={colors.textSecondary} />
                            <Text style={styles.detailText}>{info.recipientName || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Package size={14} color={colors.textSecondary} />
                            <Text style={styles.detailText} numberOfLines={1}>{info.packageDescription || 'N/A'}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <Clock size={14} color={colors.textMuted} />
                    <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                    <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Minhas Entregas</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading && !refreshing ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={deliveries}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
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
        paddingVertical: 15,
        backgroundColor: '#FFF',
        ...colors.shadow,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    deliveryCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...colors.shadow,
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
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    priceText: {
        fontSize: 16,
        fontWeight: '900',
        color: colors.text,
    },
    cardBody: {
        marginBottom: 15,
    },
    addressRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dotLineBox: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    line: {
        width: 1,
        height: 25,
        backgroundColor: '#E2E8F0',
        marginVertical: 4,
    },
    addressInfo: {
        flex: 1,
        gap: 12,
    },
    addressText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    addressTextDest: {
        fontSize: 14,
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
    }
});
