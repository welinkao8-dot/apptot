const ACTIVE_STATUSES = new Set(['accepted', 'ongoing']);

function toAppTrip(serverTrip, cachedTrip) {
    const fare = serverTrip.final_fare ?? serverTrip.estimated_fare ?? cachedTrip.price ?? null;
    return {
        ...cachedTrip,
        ...serverTrip,
        pickupAddress: serverTrip.origin_address ?? cachedTrip.pickupAddress,
        destAddress: serverTrip.dest_address ?? cachedTrip.destAddress,
        coords: {
            lat: serverTrip.origin_lat ?? cachedTrip.coords?.lat ?? null,
            lng: serverTrip.origin_lng ?? cachedTrip.coords?.lng ?? null,
        },
        destPos: {
            lat: serverTrip.dest_lat ?? cachedTrip.destPos?.lat ?? null,
            lng: serverTrip.dest_lng ?? cachedTrip.destPos?.lng ?? null,
        },
        final_fare: serverTrip.final_fare ?? null,
        current_fare: fare,
        price: fare,
    };
}

export async function reconcileActiveRide({ cachedTrip, driverId, fetchTrip, fetchPayment }) {
    if (!cachedTrip?.id || !driverId) return { trip: null, status: 'idle', clear: true };

    const serverTrip = await fetchTrip(cachedTrip.id);
    if (serverTrip?.driver_id !== driverId) return { trip: null, status: 'idle', clear: true };

    if (ACTIVE_STATUSES.has(serverTrip.status)) {
        return { trip: toAppTrip(serverTrip, cachedTrip), status: serverTrip.status, clear: false };
    }

    if (serverTrip.status === 'completed') {
        const payment = await fetchPayment(cachedTrip.id);
        if (payment?.status === 'pending') {
            return { trip: toAppTrip(serverTrip, cachedTrip), status: 'finished', clear: false };
        }
    }

    return { trip: null, status: 'idle', clear: true };
}
