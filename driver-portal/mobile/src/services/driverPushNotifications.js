export async function registerDriverPushToken({ token, platform, api }) {
    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    if (normalizedToken.length < 20) {
        throw Object.assign(new Error('Firebase did not return a valid device token.'), { code: 'PUSH_TOKEN_UNAVAILABLE' });
    }
    if (!['android', 'ios'].includes(platform)) {
        throw Object.assign(new Error('Unsupported push platform.'), { code: 'PUSH_PLATFORM_UNSUPPORTED' });
    }
    await api.post('/notifications/push-token', { token: normalizedToken, platform });
    return normalizedToken;
}

export async function removeDriverPushToken({ token, api, messaging }) {
    try {
        if (typeof token === 'string' && token.trim()) {
            await api.delete('/notifications/push-token', { data: { token: token.trim() } });
        }
    } finally {
        await messaging.deleteToken();
    }
}

export function isTripOfferMessage(message) {
    const tripId = message?.data?.tripId;
    return message?.data?.type === 'trip_offer' && typeof tripId === 'string' && tripId.length > 0
        ? tripId
        : null;
}

export async function fetchPendingTripOffer({ tripId, api }) {
    if (typeof tripId !== 'string' || !tripId || !api?.get) return null;
    try {
        const response = await api.get('/trips/pending');
        const trips = Array.isArray(response?.data) ? response.data : [];
        return trips.find((trip) => trip?.id === tripId) ?? null;
    } catch {
        return null;
    }
}

export async function openPendingTripOffer({ tripId, api, navigation, onAccept, onReject }) {
    const trip = await fetchPendingTripOffer({ tripId, api });
    if (!trip || typeof navigation?.navigate !== 'function') return null;
    navigation.navigate('RequestDetails', { trip, onAccept, onReject });
    return trip;
}
