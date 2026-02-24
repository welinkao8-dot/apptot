/**
 * TOT Driver Mobile App
 * @format
 */

import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import colors from './src/theme/colors';
import { AuthProvider } from './src/context/AuthContext';
import LocationDisclosure from './src/components/LocationDisclosure';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapboxGL from '@rnmapbox/maps';

// Set Mapbox Token Globally
MapboxGL.setAccessToken('pk.eyJ1Ijoicm9seW5nYWx1bGEiLCJhIjoiY21reW4yazd1MGEzcDNlcHZ5ZmxiOWkyeCJ9.h0ixib23eamrzruV6yvqUA');

const DISCLOSURE_KEY = '@has_seen_location_disclosure';

function App(): React.JSX.Element {
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

      // Request system permissions immediately
      if (Platform.OS === 'android') {
        const fineGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Permissão de Localização",
            message: "A TOT precisa da sua localização para receber corridas próximas e rastrear o trajeto.",
            buttonNeutral: "Depois",
            buttonNegative: "Não",
            buttonPositive: "Sim"
          }
        );

        if (fineGranted === PermissionsAndroid.RESULTS.GRANTED) {
          // If fine location is granted, request background location (API 29+)
          if (Platform.Version >= 29) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
              {
                title: "Localização em Segundo Plano",
                message: "Para garantir que a viagem não seja interrompida, permita o acesso 'O tempo todo'.",
                buttonPositive: "Permitir"
              }
            );
          }
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
        <SafeAreaView style={styles.container}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.background}
          />
          <AppNavigator />
          <LocationDisclosure
            visible={showDisclosure}
            onAccept={handleAcceptDisclosure}
          />
          <Toast />
        </SafeAreaView>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default App;
