import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    FlatList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import {
    Menu,
    Search,
    MapPin,
    Car,
    Package,
    Clock,
    User,
    ChevronRight
} from 'lucide-react-native';
import colors from '../theme/colors';
import hereService from '../services/hereService';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toSafeErrorLog } from '../utils/safeErrorLog';

const { width, height } = Dimensions.get('window');

// Ad Images
const AD_IMAGES = [
    require('../assets/ads/ad1.png'),
    require('../assets/ads/ad2.png'),
    require('../assets/ads/ad3.png'),
];

export default function DashboardScreen({ navigation }) {
    const { user } = useAuth();
    const flatListRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [pickupCoords, setPickupCoords] = useState(null);
    const [pickupAddress, setPickupAddress] = useState('A obter localização...');
    const [activeRide, setActiveRide] = useState(null);
    const [activeDeliveries, setActiveDeliveries] = useState([]);

    // 1. Location Logic (Address for Header)
    useEffect(() => {
        Geolocation.getCurrentPosition(
            async (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setPickupCoords(coords);

                // Get address for UI
                const addr = await hereService.reverseGeocode(coords.lat, coords.lng);
                if (addr) setPickupAddress(addr);
            },
            (err) => { console.log('Location Error:', err); setPickupAddress('Localização indisponível'); },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    }, []);

    // 2. Carousel Auto-scroll Logic
    useEffect(() => {
        const timer = setInterval(() => {
            let nextIndex = currentIndex + 1;
            if (nextIndex >= AD_IMAGES.length) nextIndex = 0;

            flatListRef.current?.scrollToIndex({
                index: nextIndex,
                animated: true,
            });
            setCurrentIndex(nextIndex);
        }, 5000); // 5 seconds per ad

        return () => clearInterval(timer);
    }, [currentIndex]);

    // 2. Resume Check (On Focus) & Boot Redirect
    useFocusEffect(
        useCallback(() => {
            const checkActiveStates = async () => {
                try {
                    console.log('🔍 [Dashboard] Sincronizando estado com o servidor...');
                    const res = await api.get(`/trips/active/${user.id}`);
                    const activeTrips = res.data; // Now an array

                    if (Array.isArray(activeTrips) && activeTrips.length > 0) {
                        console.log(`✅ [Dashboard] ${activeTrips.length} atividades detectadas.`);

                        // Separate into Ride and Deliveries
                        const ride = activeTrips.find(t => t.category === 'ride');
                        const deliveries = activeTrips.filter(t => t.category === 'delivery');

                        if (ride) {
                            const mappedRide = {
                                tripId: ride.id,
                                status: ride.status === 'requested' ? 'requesting' :
                                    ride.status === 'completed' ? 'waiting_payment' : ride.status,
                                destination: { name: ride.dest_address?.split(',')[0] || 'Destino' }
                            };
                            setActiveRide(mappedRide);

                            // Auto-navigation for critical ride states
                            if (['requested', 'accepted', 'ongoing', 'completed'].includes(ride.status)) {
                                navigation.navigate('RideFlow');
                            }
                        } else {
                            setActiveRide(null);
                        }

                        // For deliveries, we store the full list in state for a carousel
                        setActiveDeliveries(deliveries);

                    } else {
                        setActiveRide(null);
                        setActiveDeliveries([]);
                    }

                } catch (error) {
                    console.error('❌ [Dashboard] Erro ao sincronizar estados:', toSafeErrorLog(error));
                }
            };
            checkActiveStates();
        }, [])
    );

    // 3. Navigation Handlers
    const handleSearchPress = () => {
        navigation.navigate('RideFlow', {
            step: 'searching_address',
            pickupCoords: pickupCoords || undefined,
            pickupAddress: pickupAddress
        });
    };

    const handleCategorySelect = (category) => {
        if (category === 'ride') {
            navigation.navigate('RideFlow', {
                step: 'searching_address', // User prefers search first
                pickupCoords: pickupCoords || undefined,
                pickupAddress
            });
        } else {
            navigation.navigate('DeliveryFlow', {
                step: 'home',
                pickupCoords: pickupCoords || undefined,
                pickupAddress
            });
        }
    };

    const handleResumeRide = () => {
        navigation.navigate('RideFlow');
    };

    const handleResumeDelivery = () => {
        navigation.navigate('DeliveryFlow');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

            {/* Header Bar - Pink & Elegant */}
            <View style={styles.headerBar}>
                <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()}>
                    <Menu size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.addressContainer}>
                    <MapPin size={16} color="rgba(255,255,255,0.9)" style={{ marginRight: 6 }} />
                    <Text style={styles.headerAddressText} numberOfLines={1}>
                        {pickupAddress || 'Obtendo localização...'}
                    </Text>
                </View>
                {/* Spacer for centering address */}
                <View style={{ width: 44 }} />
            </View>

            {/* Ad Carousel Background */}
            <View style={styles.mapContainer}>
                <FlatList
                    ref={flatListRef}
                    data={AD_IMAGES}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(_, index) => index.toString()}
                    onMomentumScrollEnd={(e) => {
                        const index = Math.round(e.nativeEvent.contentOffset.x / width);
                        setCurrentIndex(index);
                    }}
                    renderItem={({ item }) => (
                        <View style={{ width: width, height: '100%' }}>
                            <Image
                                source={item}
                                style={styles.adImage}
                                resizeMode="cover"
                            />
                            {/* Stylish Overlay */}
                            <View style={styles.adOverlay} />
                        </View>
                    )}
                />
                
                {/* Pagination Dots */}
                <View style={styles.pagination}>
                    {AD_IMAGES.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                { backgroundColor: i === currentIndex ? colors.primary : 'rgba(255,255,255,0.5)' }
                            ]}
                        />
                    ))}
                </View>
            </View>

            {/* Main Bottom Sheet */}
            <View style={styles.bottomSheet}>

                {/* Active Ride Card (Priority) */}
                {activeRide && (
                    <TouchableOpacity
                        style={styles.activeTripCard}
                        onPress={handleResumeRide}
                    >
                        <View style={styles.pulsingDot} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.activeTitle}>Viagem em Andamento</Text>
                            <Text style={styles.activeSub}>Toque para voltar à corrida</Text>
                        </View>
                        <Car size={24} color="#FFF" />
                    </TouchableOpacity>
                )}

                {/* Active Deliveries List (Mini-Cards) */}
                {activeDeliveries.length > 0 && (
                    <View style={styles.deliveriesActiveContainer}>
                        <Text style={styles.miniSectionTitle}>Entregas Ativas ({activeDeliveries.length})</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deliveryTabs}>
                            {activeDeliveries.map((delivery) => (
                                <TouchableOpacity
                                    key={delivery.id}
                                    style={styles.deliveryMiniCard}
                                    onPress={() => navigation.navigate('DeliveryFlow', { tripId: delivery.id })}
                                >
                                    <Package size={18} color={colors.secondary} />
                                    <Text style={styles.deliveryMiniText} numberOfLines={1}>
                                        {delivery.dest_address?.split(',')[0]}
                                    </Text>
                                    <ChevronRight size={14} color={colors.textMuted} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <Text style={styles.sheetTitle}>Para onde vamos hoje?</Text>

                {/* Search Trigger */}
                <TouchableOpacity style={styles.searchBar} onPress={handleSearchPress}>
                    <MapPin size={20} color={colors.primary} />
                    <Text style={styles.searchText}>Digite seu destino...</Text>
                </TouchableOpacity>

                {/* Categories */}
                <View style={styles.quickChoices}>
                    <TouchableOpacity
                        style={[styles.choiceBtn, { backgroundColor: '#FDF2F5' }]}
                        onPress={() => handleCategorySelect('ride')}
                    >
                        <Car size={32} color={colors.primary} />
                        <Text style={styles.choiceLabel}>Viagem</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.choiceBtn, { backgroundColor: '#EFF6FF' }]}
                        onPress={() => handleCategorySelect('delivery')}
                    >
                        <Package size={32} color={colors.secondary} />
                        <Text style={styles.choiceLabel}>Entrega</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    mapContainer: { flex: 1, backgroundColor: '#000' }, // Black base for ads
    adImage: {
        width: width,
        height: '100%',
    },
    adOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.15)', // Very light overlay for elegance
    },
    pagination: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    headerBar: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
        justifyContent: 'space-between',
        ...colors.shadow,
        zIndex: 10,
    },
    menuButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addressContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAddressText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
        maxWidth: width * 0.6,
    },

    bottomSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 30,
        ...colors.shadow,
    },
    sheetTitle: {
        fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 20
    },
    searchBar: {
        height: 60, backgroundColor: '#F8FAFC', borderRadius: 20,
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
        borderWidth: 1.5, borderColor: '#F1F5F9', marginBottom: 25
    },
    searchText: { marginLeft: 12, fontSize: 15, color: colors.textSecondary, fontWeight: '600' },

    quickChoices: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    choiceBtn: {
        width: (width - 80) / 2, height: 120, borderRadius: 24,
        justifyContent: 'center', alignItems: 'center'
    },
    choiceLabel: { marginTop: 10, fontSize: 16, fontWeight: '800', color: colors.text },

    // Active Trip Card
    activeTripCard: {
        backgroundColor: colors.primary,
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
        ...colors.shadow
    },
    pulsingDot: {
        width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFF', marginRight: 15
    },
    activeTitle: { color: '#FFF', fontWeight: '800', fontSize: 16 },
    activeSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

    // Delivery Carousel Styles
    deliveriesActiveContainer: { marginBottom: 20 },
    miniSectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase' },
    deliveryTabs: { flexDirection: 'row' },
    deliveryMiniCard: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxWidth: 200
    },
    deliveryMiniText: { marginLeft: 8, marginRight: 5, fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 }
});
