import { JwtService } from '@nestjs/jwt';
import { RidesGateway } from './rides.gateway';

const socket = (token?: string, id = 'socket-a') => ({
  id,
  handshake: { auth: token ? { token } : {} },
  data: {},
  join: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
});

describe('RidesGateway', () => {
  const jwt = new JwtService({ secret: 'gateway-test-secret', verifyOptions: { algorithms: ['HS256'] } });
  const trips = {
    cancelOrphanTrips: jest.fn().mockResolvedValue([]),
    getDriverStatus: jest.fn().mockResolvedValue(false),
    updateDriverStatus: jest.fn().mockResolvedValue({}),
    updateDriverLocation: jest.fn().mockResolvedValue({}),
    findActiveByDriver: jest.fn().mockResolvedValue(null),
    findActiveByClient: jest.fn().mockResolvedValue(null),
    findAllPending: jest.fn().mockResolvedValue([]),
    dispatchNextBatch: jest.fn().mockResolvedValue([]),
    findRequestedTripIds: jest.fn().mockResolvedValue([]),
    declineOffer: jest.fn().mockResolvedValue({ success: true }),
    findOne: jest.fn(),
    create: jest.fn(),
    accept: jest.fn(),
    findOneForDriver: jest.fn(),
    cancel: jest.fn(),
    start: jest.fn(),
    finish: jest.fn().mockResolvedValue({ final_fare: '950.00' }),
    formatTrip: jest.fn((trip) => trip),
  };
  const payments = {
    confirmCashPayment: jest.fn().mockResolvedValue({ id: 'payment-a', amount: '950.00' }),
  };
  let gateway: RidesGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new RidesGateway(trips as never, jwt, payments as never);
    gateway.server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as never;
  });

  it.each([undefined, 'not-a-jwt'])('disconnects a socket with a missing or invalid handshake token', async (token) => {
    const client = socket(token);

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.data).not.toHaveProperty('actor');
  });

  it('disconnects a socket whose verified subject is blank', async () => {
    const client = socket(jwt.sign({ sub: '   ', role: 'driver' }));

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.data).not.toHaveProperty('actor');
    expect(client.join).not.toHaveBeenCalled();
  });

  it('uses verified claims instead of a join payload to choose the room', async () => {
    const client = socket(jwt.sign({ sub: 'client-a', role: 'client' }));

    await gateway.handleConnection(client as never);
    await gateway.handleJoin({ userId: 'driver-b', role: 'driver' }, client as never);

    expect(client.data.actor).toEqual({ id: 'client-a', role: 'client' });
    expect(client.join).toHaveBeenCalledWith('client_client-a');
    expect(client.join).not.toHaveBeenCalledWith('driver_driver-b');
    expect(trips.getDriverStatus).not.toHaveBeenCalled();
  });

  it('rejects a client cancelling another client’s trip', async () => {
    const client = socket(jwt.sign({ sub: 'client-a', role: 'client' }));
    client.data.actor = { id: 'client-a', role: 'client' };
    trips.findOne.mockResolvedValue({ id: 'trip-b', client_id: 'client-b', driver_id: null, status: 'requested' });

    await expect(gateway.handleCancelTrip({ tripId: 'trip-b' }, client as never))
      .resolves.toEqual({ success: false, error: 'Forbidden' });

    expect(trips.cancel).not.toHaveBeenCalled();
  });

  it('propagates a committed claim to the client and online drivers', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    driver.data.actor = { id: 'driver-a', role: 'driver' };
    gateway['connectedUsers'].set('driver:driver-a', { id: 'driver-a', role: 'driver', socketIds: new Set(['socket-a']), isOnline: true });
    trips.accept.mockResolvedValue({
      id: 'trip-a', client_id: 'client-a', driver_id: 'driver-a', status: 'accepted',
      profiles_trips_driver_idToprofiles: { full_name: 'Driver A' },
    });
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;

    await expect(gateway.handleAcceptTrip({ tripId: 'trip-a' }, driver as never)).resolves.toEqual({ success: true });

    expect(gateway.server.to).toHaveBeenCalledWith('client_client-a');
    expect(emit).toHaveBeenCalledWith('trip_accepted', expect.objectContaining({ tripId: 'trip-a', driver: { id: 'driver-a', name: 'Driver A' } }));
    expect(gateway.server.to).toHaveBeenCalledWith('driver_driver-a');
    expect(emit).toHaveBeenCalledWith('trip_taken', { tripId: 'trip-a', acceptedBy: 'driver-a' });
  });

  it('does not rebroadcast acceptance when the same driver retries after losing the ACK', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    driver.data.actor = { id: 'driver-a', role: 'driver' };
    gateway['connectedUsers'].set('driver:driver-a', { id: 'driver-a', role: 'driver', socketIds: new Set(['socket-a']), isOnline: true });
    const accepted = {
      id: 'trip-a', client_id: 'client-a', driver_id: 'driver-a', status: 'accepted',
      profiles_trips_driver_idToprofiles: { full_name: 'Driver A' },
    };
    trips.findOne
      .mockResolvedValueOnce({ id: 'trip-a', client_id: 'client-a', driver_id: null, status: 'requested' })
      .mockResolvedValueOnce(accepted);
    trips.accept.mockResolvedValue(accepted);
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;

    await expect(gateway.handleAcceptTrip({ tripId: 'trip-a' }, driver as never)).resolves.toEqual({ success: true });
    await expect(gateway.handleAcceptTrip({ tripId: 'trip-a' }, driver as never)).resolves.toEqual({ success: true });

    expect(trips.accept).toHaveBeenCalledTimes(2);
    expect(gateway.server.to).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(1, 'trip_accepted', expect.any(Object));
    expect(emit).toHaveBeenNthCalledWith(2, 'trip_taken', { tripId: 'trip-a', acceptedBy: 'driver-a' });
  });

  it('keeps acceptance server-authoritative and does not publish when the service rejects an expired offer', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    driver.data.actor = { id: 'driver-a', role: 'driver' };
    trips.accept.mockRejectedValueOnce(new Error('Esta oferta expirou.'));
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;

    await expect(gateway.handleAcceptTrip({ tripId: 'trip-a' }, driver as never))
      .resolves.toEqual({ success: false, error: 'Esta oferta expirou.' });

    expect(trips.accept).toHaveBeenCalledWith('trip-a', 'driver-a');
    expect(gateway.server.to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('propagates cancellation to online drivers so stale offers can be removed', async () => {
    const client = socket(jwt.sign({ sub: 'client-a', role: 'client' }));
    client.data.actor = { id: 'client-a', role: 'client' };
    gateway['connectedUsers'].set('driver:driver-a', { id: 'driver-a', role: 'driver', socketIds: new Set(['socket-driver']), isOnline: true });
    trips.findOne.mockResolvedValue({ id: 'trip-a', client_id: 'client-a', driver_id: null, status: 'requested' });
    trips.cancel.mockResolvedValue({ id: 'trip-a', client_id: 'client-a', driver_id: null, status: 'cancelled' });
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;

    await expect(gateway.handleCancelTrip({ tripId: 'trip-a' }, client as never)).resolves.toEqual({ success: true, tripId: 'trip-a' });

    expect(trips.cancel).toHaveBeenCalledWith('trip-a', { role: 'client', id: 'client-a' });
    expect(gateway.server.to).toHaveBeenCalledWith('driver_driver-a');
    expect(emit).toHaveBeenCalledWith('trip_cancelled', { tripId: 'trip-a' });
  });

  it('rejects malformed driver GPS fixes before saving or broadcasting them', async () => {
    const client = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    client.data.actor = { id: 'driver-a', role: 'driver' };
    await expect(gateway.handleUpdateLocation({ lat: Number.NaN, lng: 13.29 } as never, client as never))
      .resolves.toMatchObject({ success: false });
    expect(trips.updateDriverLocation).not.toHaveBeenCalled();
    expect(trips.findActiveByDriver).not.toHaveBeenCalled();
  });

  it.each([
    { lat: -8.84, lng: 13.29, accuracy: 101, timestamp: Date.now() },
    { lat: -8.84, lng: 13.29, accuracy: 5, timestamp: Date.now() - 121_000 },
    { lat: 91, lng: 13.29, accuracy: 5, timestamp: Date.now() },
  ])('rejects GPS fixes with poor accuracy, stale time, or out-of-range coordinates', async (fix) => {
    const client = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    client.data.actor = { id: 'driver-a', role: 'driver' };
    await expect(gateway.handleUpdateLocation(fix, client as never)).resolves.toMatchObject({ success: false });
    expect(trips.updateDriverLocation).not.toHaveBeenCalled();
    expect(trips.findActiveByDriver).not.toHaveBeenCalled();
  });

  it('publishes a validated driver fix using the event the client map listens for', async () => {
    const client = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    client.data.actor = { id: 'driver-a', role: 'driver' };
    trips.findActiveByDriver.mockResolvedValue({ client_id: 'client-a' });
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;
    const fix = { lat: -8.84, lng: 13.29, accuracy: 8, heading: 90, timestamp: Date.now() };

    await expect(gateway.handleUpdateLocation(fix, client as never)).resolves.toEqual({ success: true });

    expect(gateway.server.to).toHaveBeenCalledWith('client_client-a');
    expect(emit).toHaveBeenCalledWith('trip_update', expect.objectContaining({ coords: { lat: fix.lat, lng: fix.lng }, accuracy: 8, heading: 90, timestamp: fix.timestamp }));
  });

  it('accepts an authenticated HTTP location fix through the same persistence and broadcast path', async () => {
    trips.findActiveByDriver.mockResolvedValue({ client_id: 'client-a' });
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;
    const fix = { lat: -8.84, lng: 13.29, accuracy: 8, heading: 90, timestamp: Date.now() };

    await expect(gateway.processDriverLocation('driver-a', fix)).resolves.toEqual({ success: true });

    expect(trips.updateDriverLocation).toHaveBeenCalledWith('driver-a', fix.lat, fix.lng, fix.accuracy);
    expect(emit).toHaveBeenCalledWith('trip_update', expect.objectContaining({ driverId: 'driver-a', coords: { lat: fix.lat, lng: fix.lng } }));
  });

  it('rejects invalid heading on the shared HTTP and socket location path', async () => {
    await expect(gateway.processDriverLocation('driver-a', { lat: -8.84, lng: 13.29, heading: 360 }))
      .rejects.toThrow('Direção GPS inválida.');
    expect(trips.updateDriverLocation).not.toHaveBeenCalled();
    expect(trips.findActiveByDriver).not.toHaveBeenCalled();
  });

  it('does not broadcast a GPS jump that exceeds plausible road speed', async () => {
    const client = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    client.data.actor = { id: 'driver-a', role: 'driver' };
    trips.findActiveByDriver.mockResolvedValue({ client_id: 'client-a' });
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;
    const now = Date.now();
    await gateway.handleUpdateLocation({ lat: -8.84, lng: 13.29, accuracy: 8, timestamp: now - 2_000 }, client as never);
    await expect(gateway.handleUpdateLocation({ lat: -8.90, lng: 13.29, accuracy: 8, timestamp: now }, client as never))
      .resolves.toMatchObject({ success: false });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('acknowledges a persisted trip with its id and committed status', async () => {
    const client = socket(jwt.sign({ sub: 'client-a', role: 'client' }));
    client.data.actor = { id: 'client-a', role: 'client' };
    trips.create.mockResolvedValue({ id: 'trip-a', client_id: 'client-a', status: 'requested' });
    const result = await gateway.handleRequestTrip({ quoteId: 'quote-a' }, client as never);
    expect(result).toEqual(expect.objectContaining({ success: true, tripId: 'trip-a', status: 'requested', committedAt: expect.any(String) }));
    expect(client.emit).toHaveBeenCalledWith('trip_created', expect.objectContaining({ tripId: 'trip-a' }));
  });

  it('rejects a driver starting another driver’s trip', async () => {
    const client = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    client.data.actor = { id: 'driver-a', role: 'driver' };
    trips.findOneForDriver.mockRejectedValue(new Error('Forbidden'));

    await expect(gateway.handleStartRide({ tripId: 'trip-b' }, client as never))
      .resolves.toEqual({ success: false, error: 'Forbidden' });

    expect(trips.start).not.toHaveBeenCalled();
  });

  it('ignores a driver supplied final fare and uses the persisted trip fare', async () => {
    const client = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    client.data.actor = { id: 'driver-a', role: 'driver' };
    trips.findOneForDriver.mockResolvedValue({ id: 'trip-a', client_id: 'client-a', driver_id: 'driver-a', status: 'ongoing', estimated_fare: '950.00' });

    await expect(gateway.handleFinishRide({ tripId: 'trip-a', finalFare: '1' }, client as never)).resolves.toEqual({ success: true });
    expect(trips.finish).toHaveBeenCalledWith('trip-a', 'driver-a');
  });

  it('confirms cash through the payment service before notifying the owning client', async () => {
    const client = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    client.data.actor = { id: 'driver-a', role: 'driver' };
    trips.findOneForDriver.mockResolvedValue({ id: 'trip-a', client_id: 'client-a', driver_id: 'driver-a', status: 'completed' });
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;

    await expect(gateway.handleConfirmCashPayment({ tripId: 'trip-a', amount: '950.00' }, client as never))
      .resolves.toEqual({ success: true, paymentId: 'payment-a' });
    expect(payments.confirmCashPayment).toHaveBeenCalledWith('trip-a', 'driver-a', '950.00');
    expect(gateway.server.to).toHaveBeenCalledWith('client_client-a');
    expect(emit).toHaveBeenCalledWith('payment_confirmed', { tripId: 'trip-a', amount: '950.00', method: 'cash' });
  });

  it('rejects a client attempting to confirm a cash payment', async () => {
    const client = socket(jwt.sign({ sub: 'client-a', role: 'client' }));
    client.data.actor = { id: 'client-a', role: 'client' };
    await expect(gateway.handleConfirmCashPayment({ tripId: 'trip-a', amount: '950.00' }, client as never))
      .resolves.toEqual({ success: false, error: 'Forbidden' });
    expect(payments.confirmCashPayment).not.toHaveBeenCalled();
  });

  it('does not notify the client when cash confirmation fails to persist', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    driver.data.actor = { id: 'driver-a', role: 'driver' };
    trips.findOneForDriver.mockResolvedValue({ id: 'trip-a', client_id: 'client-a', driver_id: 'driver-a', status: 'completed' });
    payments.confirmCashPayment.mockRejectedValueOnce(new Error('payment write failed'));
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;

    await expect(gateway.handleConfirmCashPayment({ tripId: 'trip-a', amount: '950.00' }, driver as never))
      .resolves.toEqual({ success: false, error: 'payment write failed' });

    expect(gateway.server.to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps client and driver connections separate when their IDs collide', async () => {
    const client = socket(jwt.sign({ sub: 'shared-id', role: 'client' }));
    const driver = socket(jwt.sign({ sub: 'shared-id', role: 'driver' }));

    await gateway.handleConnection(client as never);
    await gateway.handleConnection(driver as never);
    await gateway.handleToggleOnline({ isOnline: true }, driver as never);
    await gateway.notifyNewTrip({ id: 'trip-a' });

    expect(trips.dispatchNextBatch).toHaveBeenCalledWith('trip-a', []);
  });

  it('sends a persisted offer only to the selected driver room', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    driver.data.actor = { id: 'driver-a', role: 'driver' };
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;
    gateway['connectedUsers'].set('driver:driver-a', { id: 'driver-a', role: 'driver', socketIds: new Set(['socket-a']), isOnline: true });
    trips.dispatchNextBatch.mockResolvedValue([{ driverId: 'driver-a', distanceKm: 1.2, expiresAt: new Date(), trip: { id: 'trip-a' } }]);
    await gateway.notifyNewTrip({ id: 'trip-a' });
    expect(gateway.server.to).toHaveBeenCalledWith('driver_driver-a');
    expect(emit).toHaveBeenCalledWith('new_trip_available', expect.objectContaining({ id: 'trip-a', driverDistanceKm: 1.2 }));
  });

  it('sends a persisted trip offer by push when the driver has no active socket', async () => {
    const pushService = { sendTripOffer: jest.fn().mockResolvedValue({ sent: 1 }) };
    const pushGateway = new RidesGateway(trips as never, jwt, payments as never, pushService as never);
    const emit = jest.fn();
    pushGateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;
    trips.dispatchNextBatch.mockResolvedValueOnce([
      { driverId: 'sleeping-driver', distanceKm: 1.2, expiresAt: new Date(), trip: { id: 'trip-a' } },
    ]);

    await pushGateway.notifyNewTrip({ id: 'trip-a' });

    expect(pushService.sendTripOffer).toHaveBeenCalledWith('sleeping-driver', 'trip-a');
    expect(pushGateway.server.to).toHaveBeenCalledWith('driver_sleeping-driver');
    expect(emit).toHaveBeenCalledWith('new_trip_available', expect.objectContaining({ id: 'trip-a' }));
  });


  it('does not repeat a live offer when the persisted dispatcher returns no new offers', async () => {
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;
    gateway['connectedUsers'].set('driver:driver-a', { id: 'driver-a', role: 'driver', socketIds: new Set(['socket-a']), isOnline: true });
    trips.dispatchNextBatch
      .mockResolvedValueOnce([{ driverId: 'driver-a', distanceKm: 1.2, expiresAt: new Date(), trip: { id: 'trip-a' } }])
      .mockResolvedValueOnce([]);

    await gateway.notifyNewTrip({ id: 'trip-a' });
    await gateway.notifyNewTrip({ id: 'trip-a' });

    expect(trips.dispatchNextBatch).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('new_trip_available', expect.objectContaining({ id: 'trip-a' }));
  });

  it('restores only server-returned pending offers after an authenticated reconnect', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    const pending = [{ id: 'trip-a', offerExpiresAt: new Date(Date.now() + 10_000).toISOString() }];
    trips.getDriverStatus.mockResolvedValue(true);
    trips.findActiveByDriver.mockResolvedValue(null);
    trips.findAllPending.mockResolvedValue(pending);

    await gateway.handleConnection(driver as never);
    await expect(gateway.handleJoin({ userId: 'driver-b' }, driver as never)).resolves.toEqual({ success: true });

    expect(trips.findAllPending).toHaveBeenCalledWith('driver-a');
    expect(driver.emit).toHaveBeenCalledWith('pending_trips', pending);
    expect(driver.join).toHaveBeenCalledWith('driver_driver-a');
    expect(driver.join).not.toHaveBeenCalledWith('driver_driver-b');
  });

  it('does not restore expired offers when the database-backed pending lookup returns none', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    trips.getDriverStatus.mockResolvedValue(true);
    trips.findActiveByDriver.mockResolvedValue(null);
    trips.findAllPending.mockResolvedValue([]);

    await gateway.handleConnection(driver as never);
    await gateway.handleJoin({}, driver as never);

    expect(trips.findAllPending).toHaveBeenCalledWith('driver-a');
    expect(driver.emit).not.toHaveBeenCalledWith('pending_trips', expect.anything());
  });

  it('persists a decline and immediately advances dispatch for that request', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    driver.data.actor = { id: 'driver-a', role: 'driver' };
    gateway['connectedUsers'].set('driver:driver-a', { id: 'driver-a', role: 'driver', socketIds: new Set(['socket-a']), isOnline: true });
    await expect(gateway.handleDeclineTrip({ tripId: 'trip-a' }, driver as never)).resolves.toEqual({ success: true });
    expect(trips.declineOffer).toHaveBeenCalledWith('trip-a', 'driver-a');
    expect(trips.dispatchNextBatch).toHaveBeenCalledWith('trip-a', []);
  });

  it('rejects out-of-range coordinates on the legacy trip_progress event', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    driver.data.actor = { id: 'driver-a', role: 'driver' };
    trips.findOneForDriver.mockResolvedValue({ id: 'trip-a', client_id: 'client-a', driver_id: 'driver-a', status: 'ongoing' });
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;

    await expect(gateway.handleTripProgress({ tripId: 'trip-a', coords: { lat: 91, lng: 13 } }, driver as never))
      .resolves.toMatchObject({ success: false });

    expect(gateway.server.to).not.toHaveBeenCalled();
  });

  it('rejects non-boolean online state instead of coercing it', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    await gateway.handleConnection(driver as never);

    await expect(gateway.handleToggleOnline({ isOnline: 'false' } as never, driver as never))
      .resolves.toEqual({ success: false, error: 'Invalid availability value' });
    expect(trips.updateDriverStatus).not.toHaveBeenCalled();
  });

  it('keeps an actor registered while another of their sockets remains connected', async () => {
    const firstSocket = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }), 'socket-a');
    const secondSocket = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }), 'socket-b');

    await gateway.handleConnection(firstSocket as never);
    await gateway.handleConnection(secondSocket as never);
    await gateway.handleToggleOnline({ isOnline: true }, secondSocket as never);
    gateway.handleDisconnect(secondSocket as never);
    await gateway.notifyNewTrip({ id: 'trip-a' });

    expect(trips.dispatchNextBatch).toHaveBeenCalledWith('trip-a', []);
  });
});
