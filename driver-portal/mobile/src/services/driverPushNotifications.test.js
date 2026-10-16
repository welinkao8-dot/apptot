import { registerDriverPushToken, removeDriverPushToken, isTripOfferMessage } from './driverPushNotifications';

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
});
