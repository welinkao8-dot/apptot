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
    findActiveByDriver: jest.fn().mockResolvedValue(null),
    findActiveByClient: jest.fn().mockResolvedValue(null),
    findAllPending: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    findOneForDriver: jest.fn(),
    cancel: jest.fn(),
    start: jest.fn(),
    finish: jest.fn().mockResolvedValue({ final_fare: '950.00' }),
    formatTrip: jest.fn((trip) => trip),
  };
  let gateway: RidesGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new RidesGateway(trips as never, jwt);
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

  it('keeps client and driver connections separate when their IDs collide', async () => {
    const client = socket(jwt.sign({ sub: 'shared-id', role: 'client' }));
    const driver = socket(jwt.sign({ sub: 'shared-id', role: 'driver' }));

    await gateway.handleConnection(client as never);
    await gateway.handleConnection(driver as never);
    await gateway.handleToggleOnline({ isOnline: true }, driver as never);
    gateway.notifyNewTrip({ id: 'trip-a' });

    expect(gateway.server.to).toHaveBeenCalledWith('driver_shared-id');
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
    gateway.notifyNewTrip({ id: 'trip-a' });

    expect(gateway.server.to).toHaveBeenCalledWith('driver_driver-a');
  });
});
