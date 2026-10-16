export function isValidLocationFix(location) {
    const coords = location?.coords;
    const timestamp = Number(coords?.timestamp);
    return Number.isFinite(coords?.latitude)
        && coords.latitude >= -90
        && coords.latitude <= 90
        && Number.isFinite(coords?.longitude)
        && coords.longitude >= -180
        && coords.longitude <= 180
        && Number.isFinite(coords?.accuracy)
        && coords.accuracy >= 0
        && coords.accuracy <= 100
        && Number.isFinite(timestamp)
        && Math.abs(Date.now() - timestamp) <= 120_000;
}

export function emitDriverLocation(socket, location) {
    if (!socket?.connected || !isValidLocationFix(location)) return false;
    const { latitude, longitude, accuracy, heading, timestamp } = location.coords;
    socket.emit('update_location', { lat: latitude, lng: longitude, accuracy, heading, timestamp });
    return true;
}

export async function flushLatestDriverLocation({ socket, locationModule }) {
    if (!socket?.connected || !locationModule?.getLatestLocation) return false;
    try {
        const location = await locationModule.getLatestLocation();
        return emitDriverLocation(socket, location);
    } catch {
        return false;
    }
}

export function startAndWaitForLocationFix({ locationModule, eventEmitter, timeoutMs = 15_000 }) {
    if (!locationModule?.startLocationUpdates || !eventEmitter?.addListener) {
        return Promise.reject(Object.assign(new Error('Serviço de localização indisponível.'), { code: 'LOCATION_UNAVAILABLE' }));
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        let subscription;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            subscription?.remove?.();
            callback(value);
        };
        const timer = setTimeout(() => {
            finish(reject, Object.assign(new Error('Não foi recebida uma localização GPS válida.'), { code: 'LOCATION_FIX_TIMEOUT' }));
        }, timeoutMs);

        subscription = eventEmitter.addListener('onLocationUpdate', (location) => {
            if (isValidLocationFix(location)) finish(resolve, location);
        });

        try {
            locationModule.startLocationUpdates();
        } catch {
            finish(reject, Object.assign(new Error('Não foi possível iniciar a localização.'), { code: 'LOCATION_START_FAILED' }));
        }
    });
}
