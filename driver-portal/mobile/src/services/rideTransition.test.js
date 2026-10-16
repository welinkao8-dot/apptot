import { runRideTransitionWithReconciliation } from './rideTransition';

describe('runRideTransitionWithReconciliation', () => {
    const trip = { id: 'trip-1', driver_id: 'driver-1', price: '900.00' };

    it('uses the transition ACK without making a REST request', async () => {
        const fetchTrip = jest.fn();
        const result = await runRideTransitionWithReconciliation({
            trip, driverId: 'driver-1', targetStatus: 'ongoing', transition: async () => {}, fetchTrip,
        });
        expect(result).toMatchObject({ status: 'ongoing', reconciled: false, trip });
        expect(fetchTrip).not.toHaveBeenCalled();
    });

    it('recovers a committed transition when its socket acknowledgement is lost', async () => {
        const result = await runRideTransitionWithReconciliation({
            trip,
            driverId: 'driver-1',
            targetStatus: 'completed',
            transition: async () => { throw Object.assign(new Error('timeout'), { code: 'ACK_TIMEOUT' }); },
            fetchTrip: async () => ({ id: 'trip-1', driver_id: 'driver-1', status: 'completed', final_fare: '925.50' }),
        });
        expect(result).toMatchObject({ status: 'completed', reconciled: true, trip: { final_fare: '925.50', price: '925.50' } });
    });

    it('does not advance when the server has not committed or the trip belongs to another driver', async () => {
        const timeout = Object.assign(new Error('timeout'), { code: 'ACK_TIMEOUT' });
        await expect(runRideTransitionWithReconciliation({
            trip, driverId: 'driver-1', targetStatus: 'ongoing', transition: async () => { throw timeout; },
            fetchTrip: async () => ({ id: 'trip-1', driver_id: 'driver-1', status: 'accepted' }),
        })).rejects.toBe(timeout);
        await expect(runRideTransitionWithReconciliation({
            trip, driverId: 'driver-1', targetStatus: 'completed', transition: async () => { throw timeout; },
            fetchTrip: async () => ({ id: 'trip-1', driver_id: 'driver-2', status: 'completed' }),
        })).rejects.toBe(timeout);
    });
});
