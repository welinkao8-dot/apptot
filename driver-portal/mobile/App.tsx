/**
 * TOT Driver Mobile App
 * @format
 */

import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import colors from './src/theme/colors';
import { AuthProvider } from './src/context/AuthContext';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapboxGL from '@rnmapbox/maps';

// Set Mapbox Token Globally
MapboxGL.setAccessToken('pk.eyJ1Ijoicm9seW5nYWx1bGEiLCJhIjoiY21reW4yazd1MGEzcDNlcHZ5ZmxiOWkyeCJ9.h0ixib23eamrzruV6yvqUA');

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.background}
          />
          <AppNavigator />
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
