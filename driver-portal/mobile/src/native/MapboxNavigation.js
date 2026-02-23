import { NativeModules } from 'react-native';

const { MapboxNavigationModule } = NativeModules;
const MapboxNavigation = MapboxNavigationModule;

export default {
    /**
     * Starts an Uber-grade ride flow from pickup to dropoff.
     * @param {Object} pickup - { lat: number, lng: number }
     * @param {Object} dropoff - { lat: number, lng: number }
     */
    startUberRide: (pickup, dropoff, status) => {
        if (!MapboxNavigation) {
            console.error('MapboxNavigation native module is not linked.');
            return;
        }
        MapboxNavigation.startUberRide(pickup, dropoff, status);
    },

    /**
     * Stops current navigation session.
     */
    stopNavigation: () => {
        if (!MapboxNavigation) return;
        MapboxNavigation.stopNavigation();
    },

    /**
     * Mutes or unmutes voice instructions.
     * @param {boolean} muted
     */
    setMuted: (muted) => {
        if (!MapboxNavigation) return;
        MapboxNavigation.setMuted(muted);
    }
};
