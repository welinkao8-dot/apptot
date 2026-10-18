import { registerDriverPushToken, removeDriverPushToken, isTripOfferMessage, fetchPendingTripOffer, openPendingTripOffer } from './driverPushNotifications';

describe('driver push notifications', () => {
  it('registers the current Firebase token with the authenticated driver API', async () => {
    const api = { post: jest.fn().mockResolvedValue({ data: { success: true } }) };

    await expect(registerDriverPushToken({ token: 'fcm-token-value-1234567890', platform: 'android', api }))
      .resolves.toBe('fcm-token-value-1234567890');
    expect(api.post).toHaveBeenCalledWith('/notifications/push-token', {
      token: 'fcm-token-value-1234567890',
      platform: 'android',
    });
  });

  it('does not send an empty token to the API', async () => {
    const api = { post: jest.fn() };

    await expect(registerDriverPushToken({ token: '', platform: 'android', api }))
      .rejects.toMatchObject({ code: 'PUSH_TOKEN_UNAVAILABLE' });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('removes the token from the API before deleting it from Firebase', async () => {
    const calls = [];
    const api = { delete: jest.fn(async (_path, config) => calls.push(['api', config.data.token])) };
    const messaging = { deleteToken: jest.fn(async () => calls.push(['firebase'])) };

    await removeDriverPushToken({ token: 'fcm-token-value-1234567890', api, messaging });

    expect(calls).toEqual([['api', 'fcm-token-value-1234567890'], ['firebase']]);
  });

  it('recognizes only trip-offer notifications', () => {
    expect(isTripOfferMessage({ data: { type: 'trip_offer', tripId: 'trip-a' } })).toEqual('trip-a');
    expect(isTripOfferMessage({ data: { type: 'payment_update', tripId: 'trip-a' } })).toBeNull();
    expect(isTripOfferMessage({ data: { type: 'trip_offer' } })).toBeNull();
  });

  it('returns a push offer only when the authenticated pending endpoint still lists it', async () => {
    const offer = { id: 'trip-current', status: 'requested', offerExpiresAt: new Date(Date.now() + 10_000).toISOString() };
    const api = { get: jest.fn().mockResolvedValue({ data: [offer, { id: 'trip-other' }] }) };

    await expect(fetchPendingTripOffer({ tripId: 'trip-current', api })).resolves.toEqual(offer);
    await expect(fetchPendingTripOffer({ tripId: 'trip-stale', api })).resolves.toBeNull();
    expect(api.get).toHaveBeenCalledWith('/trips/pending');
  });

  it('does not open an offer if the pending lookup fails', async () => {
    const api = { get: jest.fn().mockRejectedValue(new Error('offline')) };

    await expect(fetchPendingTripOffer({ tripId: 'trip-a', api })).resolves.toBeNull();
  });

  it('navigates to details only with the trip returned by the pending endpoint', async () => {
    const trip = { id: 'trip-current', status: 'requested' };
    const api = { get: jest.fn().mockResolvedValue({ data: [trip] }) };
    const navigation = { navigate: jest.fn() };
    const onAccept = jest.fn();
    const onReject = jest.fn();

    await expect(openPendingTripOffer({ tripId: trip.id, api, navigation, onAccept, onReject })).resolves.toEqual(trip);
    expect(navigation.navigate).toHaveBeenCalledWith('RequestDetails', { trip, onAccept, onReject });
  });

  it('does not navigate to details for a stale push', async () => {
    const api = { get: jest.fn().mockResolvedValue({ data: [] }) };
    const navigation = { navigate: jest.fn() };

    await expect(openPendingTripOffer({ tripId: 'trip-expired', api, navigation })).resolves.toBeNull();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
