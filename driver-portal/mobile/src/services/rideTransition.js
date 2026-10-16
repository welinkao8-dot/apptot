const RECONCILABLE_ERRORS = new Set(['ACK_TIMEOUT', 'SOCKET_DISCONNECTED']);

function mergeServerTrip(trip, serverTrip, targetStatus) {
    const fare = targetStatus === 'completed'
        ? serverTrip.final_fare ?? null
        : serverTrip.final_fare ?? serverTrip.estimated_fare ?? trip.price ?? null;
    return { ...trip, ...serverTrip, current_fare: fare, price: fare };
}

export async function runRideTransitionWithReconciliation({ trip, driverId, targetStatus, transition, fetchTrip }) {
    try {
        await transition();
    } catch (commandError) {
        if (!RECONCILABLE_ERRORS.has(commandError?.code)) throw commandError;

        try {
            const serverTrip = await fetchTrip(trip.id);
            if (serverTrip?.driver_id !== driverId || serverTrip?.status !== targetStatus) throw commandError;
            return {
                trip: mergeServerTrip(trip, serverTrip, targetStatus),
                status: targetStatus,
                reconciled: true,
            };
        } catch {
            throw commandError;
        }
    }

    if (targetStatus !== 'completed') return { trip, status: targetStatus, reconciled: false };

    const serverTrip = await fetchTrip(trip.id);
    if (serverTrip?.driver_id !== driverId || serverTrip?.status !== targetStatus) {
        throw new Error('A corrida ainda não foi persistida como concluída pelo servidor.');
    }
    return {
        trip: mergeServerTrip(trip, serverTrip, targetStatus),
        status: targetStatus,
        reconciled: true,
    };
}
