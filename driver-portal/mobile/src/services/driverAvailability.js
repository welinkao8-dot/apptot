import { emitSocketCommand } from './socketCommands';

export async function requestDriverAvailability({ socket, locationModule, isOnline, hasLocationPermission, startAndWaitForLocationFix, platform, ensureBackgroundLocationAuthorization }) {
    if (!isOnline) {
        // Stop sharing location as soon as the driver asks to go offline. A lost
        // socket ACK must not keep the native foreground service uploading.
        try {
            await locationModule?.stopLocationUpdates?.();
        } catch {
            // Still send the explicit offline command; local cleanup can be retried.
        }
    }

    if (isOnline) {
        if (!await hasLocationPermission()) {
            throw Object.assign(new Error('Permissão de localização necessária.'), { code: 'LOCATION_PERMISSION_DENIED' });
        }
        if (platform === 'ios') {
            if (typeof ensureBackgroundLocationAuthorization !== 'function') {
                throw Object.assign(new Error('Autorização de localização em segundo plano necessária.'), { code: 'LOCATION_BACKGROUND_PERMISSION_DENIED' });
            }
            await ensureBackgroundLocationAuthorization();
        }
        if (!locationModule?.startLocationUpdates || !startAndWaitForLocationFix) {
            throw Object.assign(new Error('Serviço de localização indisponível.'), { code: 'LOCATION_UNAVAILABLE' });
        }

        try {
            await startAndWaitForLocationFix();
        } catch (error) {
            locationModule.stopLocationUpdates?.();
            if (error?.code?.startsWith('LOCATION_')) throw error;
            throw Object.assign(new Error('Não foi possível iniciar a localização.'), { code: 'LOCATION_START_FAILED' });
        }
    }

    try {
        const result = await emitSocketCommand(socket, 'toggle_online', { isOnline });
        return result;
    } catch (error) {
        // Keep tracking through an ACK timeout: the server may have committed the online state.
        if (isOnline && error.code !== 'ACK_TIMEOUT') locationModule?.stopLocationUpdates?.();
        if (!isOnline && error.code === 'ACK_TIMEOUT') error.serverStateUncertain = true;
        throw error;
    }
}

export async function restoreDriverAvailability({ socket, locationModule, isOnline, hasLocationPermission, startAndWaitForLocationFix, platform, ensureBackgroundLocationAuthorization }) {
    if (!isOnline) {
        locationModule?.stopLocationUpdates?.();
        return { serverOnline: false, trackingStarted: false, syncFailed: false };
    }

    let trackingStarted = false;
    try {
        const hasBackgroundAuthorization = platform !== 'ios'
            || (typeof ensureBackgroundLocationAuthorization === 'function' && await ensureBackgroundLocationAuthorization());
        if (hasBackgroundAuthorization && locationModule?.startLocationUpdates && startAndWaitForLocationFix && await hasLocationPermission()) {
            await startAndWaitForLocationFix();
            trackingStarted = true;
        }
    } catch {
        trackingStarted = false;
    }

    if (trackingStarted) return { serverOnline: true, trackingStarted: true, syncFailed: false };

    locationModule?.stopLocationUpdates?.();
    try {
        await emitSocketCommand(socket, 'toggle_online', { isOnline: false });
        return { serverOnline: false, trackingStarted: false, syncFailed: false };
    } catch {
        // Keep the server's known state visible when we cannot confirm an offline transition.
        return { serverOnline: true, trackingStarted: false, syncFailed: true };
    }
}
