import React, { useState, useEffect } from 'react';
import { StatusBar, LogBox, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LocationDisclosure from './src/components/LocationDisclosure';

// Ignore specific logs if necessary
LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);

const toastConfig = {
    // ... (toastConfig remains same)
    success: (props: any) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: '#4ade80' }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{
                fontSize: 15,
                fontWeight: '400'
            }}
        />
    ),
    error: (props: any) => (
        <ErrorToast
            {...props}
            text1Style={{
                fontSize: 15,
                fontWeight: '400'
            }}
            text2Style={{
                fontSize: 13,
                color: '#666'
            }}
        />
    ),
    warning: (props: any) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: '#F59E0B' }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{
                fontSize: 15,
                fontWeight: '700'
            }}
        />
    )
};

const DISCLOSURE_KEY = '@has_seen_location_disclosure';

const App = () => {
    const [showDisclosure, setShowDisclosure] = useState(false);

    useEffect(() => {
        checkDisclosure();
    }, []);

    const checkDisclosure = async () => {
        try {
            const hasSeen = await AsyncStorage.getItem(DISCLOSURE_KEY);
            if (!hasSeen) {
                setShowDisclosure(true);
            }
        } catch (e) {
            console.error('Error checking disclosure:', e);
        }
    };

    const handleAcceptDisclosure = async () => {
        try {
            await AsyncStorage.setItem(DISCLOSURE_KEY, 'true');
            setShowDisclosure(false);

            // Request system permission immediately after disclosure
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: "Permissão de Localização",
                        message: "O TOT MOTO TÁXI precisa da sua localização para encontrar motoristas próximos e calcular a rota.",
                        buttonNeutral: "Perguntar Depois",
                        buttonNegative: "Cancelar",
                        buttonPositive: "OK"
                    }
                );

                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('Location permission granted');
                }
            }
        } catch (e) {
            console.error('Error saving disclosure status:', e);
            setShowDisclosure(false);
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
                <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
                <AppNavigator />
                <LocationDisclosure
                    visible={showDisclosure}
                    onAccept={handleAcceptDisclosure}
                />
                <Toast config={toastConfig} />
            </AuthProvider>
        </GestureHandlerRootView>
    );
};

export default App;
