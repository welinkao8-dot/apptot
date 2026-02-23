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
    ScrollView
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
import HereMap from '../components/HereMap';
import hereService from '../services/hereService';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
    const { user } = useAuth();
    const mapRef = useRef(null);
    const [pickupCoords, setPickupCoords] = useState({ lat: -8.839, lng: 13.289 });
    const [pickupAddress, setPickupAddress] = useState('Obtendo localização...');
    const [activeRide, setActiveRide] = useState(null);
    const [activeDeliveries, setActiveDeliveries] = useState([]);

    // 1. Location Logic (One-time fetch for Hub)
    useEffect(() => {
        Geolocation.getCurrentPosition(
            async (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setPickupCoords(coords);
                mapRef.current?.setUserLocation(coords); // Update map

                // Get address for UI
                const addr = await hereService.reverseGeocode(coords.lat, coords.lng);
                if (addr) setPickupAddress(addr);
            },
            (err) => console.log('Hub GPS Error:', err),
            { enableHighAccuracy: true }
        );
    }, []);

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
                    console.error('❌ [Dashboard] Erro ao sincronizar estados:', error);
                }
            };
            checkActiveStates();
        }, [])
    );

    // 3. Navigation Handlers
    const handleSearchPress = () => {
        navigation.navigate('RideFlow', {
            step: 'searching_address',
            pickupCoords: pickupCoords,
            pickupAddress: pickupAddress
        });
    };

    const handleCategorySelect = (category) => {
        if (category === 'ride') {
            navigation.navigate('RideFlow', {
                step: 'searching_address', // User prefers search first
                pickupCoords,
                pickupAddress
            });
        } else {
            navigation.navigate('DeliveryFlow', {
                step: 'home',
                pickupCoords,
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
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" translucent />

            {/* Background Map - Purely Visual in Hub */}
            <View style={styles.mapContainer}>
                <HereMap ref={mapRef} initialCenter={pickupCoords} />
            </View>

            {/* Header */}
            <View style={styles.headerFloating}>
                <TouchableOpacity style={styles.iconCircle} onPress={() => navigation.openDrawer()}>
                    <Menu size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.userInfo}>
                    <Text style={styles.welcomeText}>Olá, {user?.full_name?.split(' ')[0]}</Text>
                    <Text style={styles.locationLabel} numberOfLines={1}>{pickupAddress?.split(',')[0]}</Text>
                </View>
                <TouchableOpacity style={styles.iconCircle} onPress={handleSearchPress}>
                    <Search size={24} color={colors.text} />
                </TouchableOpacity>
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
    mapContainer: { flex: 1 },
    headerFloating: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    iconCircle: {
        width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center', ...colors.shadow
    },
    userInfo: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    welcomeText: { fontSize: 14, fontWeight: '800', color: colors.text },
    locationLabel: { fontSize: 12, color: colors.primary, fontWeight: '700' },

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
