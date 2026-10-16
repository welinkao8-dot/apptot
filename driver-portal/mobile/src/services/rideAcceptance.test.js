import { acceptRideWithReconciliation } from './rideAcceptance';

describe('acceptRideWithReconciliation', () => {
    const offer = { id: 'trip-1', coords: { lat: -8.8, lng: 13.2 }, price: '900.00' };

    it('uses the normal ACK path without an extra API request', async () => {
        const fetchTrip = jest.fn();
        const result = await acceptRideWithReconciliation({
            trip: offer,
            driverId: 'driver-1',
            accept: async () => {},
            fetchTrip,
        });

        expect(result).toMatchObject({ rideStatus: 'accepted', reconciled: false, trip: offer });
        expect(fetchTrip).not.toHaveBeenCalled();
    });

    it('restores the ride from server truth when the ACK timed out after commit', async () => {
        const result = await acceptRideWithReconciliation({
            trip: offer,
            driverId: 'driver-1',
            accept: async () => { throw Object.assign(new Error('timeout'), { code: 'ACK_TIMEOUT' }); },
            fetchTrip: async () => ({ id: 'trip-1', driver_id: 'driver-1', status: 'ongoing', final_fare: '925.50' }),
        });

        expect(result).toMatchObject({
            rideStatus: 'ongoing',
            reconciled: true,
            trip: { id: 'trip-1', coords: offer.coords, status: 'ongoing', final_fare: '925.50', price: '925.50' },
        });
    });

    it('does not claim a ride if the server says it belongs to another driver', async () => {
        await expect(acceptRideWithReconciliation({
            trip: offer,
            driverId: 'driver-1',
            accept: async () => { throw Object.assign(new Error('timeout'), { code: 'ACK_TIMEOUT' }); },
            fetchTrip: async () => ({ id: 'trip-1', driver_id: 'driver-2', status: 'accepted' }),
        })).rejects.toMatchObject({ code: 'ACK_TIMEOUT' });
    });
});
