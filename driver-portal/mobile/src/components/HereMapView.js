import React from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
// import { WebView } from 'react-native-webview'; // Instalar depois

const HereMapView = ({
    userLocation,
    route,
    onMapReady
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.placeholder}>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.text}>Carregando Mapa HERE...</Text>
                <Text style={styles.subtext}>(Requer react-native-webview)</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e2e8f0',
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        marginTop: 10,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#334155',
    },
    subtext: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4
    }
});

export default HereMapView;
