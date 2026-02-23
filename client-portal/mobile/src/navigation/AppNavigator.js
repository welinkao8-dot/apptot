import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import colors from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

// Import Components
import Sidebar from '../components/Sidebar';

// Import Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import DeliveriesScreen from '../screens/DeliveriesScreen';
import RideFlowScreen from '../screens/RideFlowScreen';
import DeliveryFlowScreen from '../screens/DeliveryFlowScreen';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

function MainDrawer() {
    return (
        <Drawer.Navigator
            drawerContent={(props) => <Sidebar {...props} />}
            screenOptions={{
                headerShown: false,
                drawerType: 'front',
                drawerStyle: {
                    width: '80%',
                    backgroundColor: '#FFF',
                }
            }}
        >
            <Drawer.Screen name="Dashboard" component={DashboardScreen} />
            <Drawer.Screen name="History" component={HistoryScreen} />
            <Drawer.Screen name="Deliveries" component={DeliveriesScreen} />
            <Drawer.Screen name="RideFlow" component={RideFlowScreen} options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
            <Drawer.Screen name="DeliveryFlow" component={DeliveryFlowScreen} options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
        </Drawer.Navigator>
    );
}

export default function AppNavigator() {
    const { user, loading } = useAuth();
    const [initialRoute, setInitialRoute] = useState('App');
    const [isCheckingRide, setIsCheckingRide] = useState(true);

    useEffect(() => {
        const checkActiveRide = async () => {
            if (user) {
                try {
                    console.log('🔍 [BOOT] Verificando corrida ativa no servidor...');
                    const res = await api.get(`/trips/active/${user.id}`);
                    const activeTrips = res.data;

                    if (Array.isArray(activeTrips)) {
                        const ride = activeTrips.find(t => t.category === 'ride');
                        if (ride && ['requested', 'accepted', 'ongoing', 'completed'].includes(ride.status)) {
                            console.log('🔒 [BOOT] Corrida ativa encontrada!', ride.id);
                            setInitialRoute('App'); // Go to App stack
                        }
                    }
                } catch (e) {
                    console.error('Boot Check Error:', e);
                }
            }
            setIsCheckingRide(false);
        };
        checkActiveRide();
    }, [user]);

    if (loading || (user && isCheckingRide)) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={user ? initialRoute : "Login"}>
                {!user ? (
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : (
                    <>
                        <Stack.Screen name="App" component={MainDrawer} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
