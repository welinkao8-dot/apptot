import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import MapboxNavigation from '../native/MapboxNavigation';
import MapboxNativeView from '../native/MapboxNativeView';
import { Maximize2, Navigation2 } from 'lucide-react-native';

const MapboxNavigationLayer = ({
    trip,
    rideStatus,
    isMinimized,
    onToggleMinimize,
    onLocationUpdate
}) => {
    const isStarted = useRef(false);

    useEffect(() => {
        if (!trip) return;

        if (rideStatus === 'accepted' || rideStatus === 'ongoing') {
            console.log('🏁 Iniciando Fluxo Uber-grade (Pickup -> Dropoff)...');
            MapboxNavigation.startUberRide(
                trip.pickup_location || trip.coords,
                trip.dropoff_location || trip.destPos,
                rideStatus
            );
            isStarted.current = true;
        } else if (rideStatus === 'idle' || rideStatus === 'finished') {
            if (isStarted.current) {
                MapboxNavigation.stopNavigation();
                isStarted.current = false;
            }
        }

        // ✅ FIX: Cleanup on unmount to prevent navigation running after View is destroyed
        return () => {
            if (isStarted.current) {
                MapboxNavigation.stopNavigation();
                isStarted.current = false;
            }
        };
    }, [trip, rideStatus]);

    return (
        <View style={styles.container}>
            <MapboxNativeView
                style={styles.map}
            // Token and Style are managed natively now
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    map: { flex: 1 },
    controls: {
        position: 'absolute',
        bottom: 120,
        right: 20,
        gap: 12,
    },
    controlButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    }
});

export default MapboxNavigationLayer;
