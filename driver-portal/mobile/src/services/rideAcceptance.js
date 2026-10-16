const ACTIVE_RIDE_STATES = new Set(['accepted', 'ongoing', 'completed']);

function toRideScreenStatus(status) {
    return status === 'completed' ? 'finished' : status;
}

export async function acceptRideWithReconciliation({ trip, driverId, accept, fetchTrip }) {
    try {
        await accept();
        return { trip, rideStatus: 'accepted', reconciled: false };
    } catch (commandError) {
        if (!['ACK_TIMEOUT', 'SOCKET_DISCONNECTED'].includes(commandError?.code)) throw commandError;

        try {
            const serverTrip = await fetchTrip(trip.id);
            if (serverTrip?.driver_id !== driverId || !ACTIVE_RIDE_STATES.has(serverTrip?.status)) throw commandError;

            const fare = serverTrip.final_fare ?? serverTrip.estimated_fare ?? trip.price ?? null;
            const restoredTrip = {
                ...trip,
                status: serverTrip.status,
                driver_id: serverTrip.driver_id,
                final_fare: serverTrip.final_fare ?? null,
                current_fare: fare,
                price: fare,
            };
            return { trip: restoredTrip, rideStatus: toRideScreenStatus(serverTrip.status), reconciled: true };
        } catch {
            throw commandError;
        }
    }
}
