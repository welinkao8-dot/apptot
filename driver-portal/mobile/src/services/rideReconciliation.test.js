import { reconcileActiveRide } from './rideReconciliation';

describe('reconcileActiveRide', () => {
    const cachedTrip = {
        id: 'trip-1',
        coords: { lat: -8.8, lng: 13.2 },
        destPos: { lat: -8.9, lng: 13.3 },
        pickupAddress: 'Origem antiga',
        destAddress: 'Destino antigo',
        price: '900.00',
    };

    it('uses the authenticated server trip to refresh status, addresses, coordinates and fare', async () => {
        const result = await reconcileActiveRide({
            cachedTrip,
            driverId: 'driver-1',
            fetchTrip: async () => ({
                id: 'trip-1', driver_id: 'driver-1', status: 'ongoing',
                origin_lat: -8.81, origin_lng: 13.21, dest_lat: -8.91, dest_lng: 13.31,
                origin_address: 'Origem atual', dest_address: 'Destino atual', estimated_fare: '950.00', final_fare: null,
            }),
            fetchPayment: async () => null,
        });

        expect(result).toMatchObject({
            status: 'ongoing',
            trip: {
                id: 'trip-1', status: 'ongoing',
                coords: { lat: -8.81, lng: 13.21 },
                destPos: { lat: -8.91, lng: 13.31 },
                pickupAddress: 'Origem atual', destAddress: 'Destino atual',
                price: '950.00', current_fare: '950.00',
            },
        });
    });

    it('clears a cached ride that the server assigned to a different driver', async () => {
        await expect(reconcileActiveRide({
            cachedTrip,
            driverId: 'driver-1',
            fetchTrip: async () => ({ id: 'trip-1', driver_id: 'driver-2', status: 'accepted' }),
            fetchPayment: async () => null,
        })).resolves.toEqual({ trip: null, status: 'idle', clear: true });
    });

    it('keeps a completed ride only while its payment is pending', async () => {
        const fetchTrip = async () => ({ id: 'trip-1', driver_id: 'driver-1', status: 'completed', estimated_fare: '900.00' });

        await expect(reconcileActiveRide({ cachedTrip, driverId: 'driver-1', fetchTrip, fetchPayment: async () => ({ status: 'pending' }) }))
            .resolves.toMatchObject({ status: 'finished', trip: { id: 'trip-1' }, clear: false });
        await expect(reconcileActiveRide({ cachedTrip, driverId: 'driver-1', fetchTrip, fetchPayment: async () => ({ status: 'confirmed' }) }))
            .resolves.toEqual({ trip: null, status: 'idle', clear: true });
    });
});
