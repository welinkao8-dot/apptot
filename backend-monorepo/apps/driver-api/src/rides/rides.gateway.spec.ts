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

  it('keeps client and driver connections separate when their IDs collide', async () => {
    const client = socket(jwt.sign({ sub: 'shared-id', role: 'client' }));
    const driver = socket(jwt.sign({ sub: 'shared-id', role: 'driver' }));

    await gateway.handleConnection(client as never);
    await gateway.handleConnection(driver as never);
    await gateway.handleToggleOnline({ isOnline: true }, driver as never);
    await gateway.notifyNewTrip({ id: 'trip-a' });

    expect(trips.dispatchNextBatch).toHaveBeenCalledWith('trip-a', ['shared-id']);
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

  it('persists a decline and immediately advances dispatch for that request', async () => {
    const driver = socket(jwt.sign({ sub: 'driver-a', role: 'driver' }));
    driver.data.actor = { id: 'driver-a', role: 'driver' };
    gateway['connectedUsers'].set('driver:driver-a', { id: 'driver-a', role: 'driver', socketIds: new Set(['socket-a']), isOnline: true });
    await expect(gateway.handleDeclineTrip({ tripId: 'trip-a' }, driver as never)).resolves.toEqual({ success: true });
    expect(trips.declineOffer).toHaveBeenCalledWith('trip-a', 'driver-a');
    expect(trips.dispatchNextBatch).toHaveBeenCalledWith('trip-a', ['driver-a']);
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

    expect(trips.dispatchNextBatch).toHaveBeenCalledWith('trip-a', ['driver-a']);
  });
});
