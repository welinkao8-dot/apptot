import { requestDriverAvailability, restoreDriverAvailability } from './driverAvailability';

describe('requestDriverAvailability', () => {
  it('does not mark an iOS driver online without Always location authorization', async () => {
    const socket = { connected: true, emit: jest.fn() };
    const locationModule = { startLocationUpdates: jest.fn(), stopLocationUpdates: jest.fn() };

    await expect(requestDriverAvailability({
      socket,
      locationModule,
      isOnline: true,
      platform: 'ios',
      hasLocationPermission: async () => true,
      ensureBackgroundLocationAuthorization: async () => { throw Object.assign(new Error('Always permission denied'), { code: 'LOCATION_BACKGROUND_PERMISSION_DENIED' }); },
      startAndWaitForLocationFix: jest.fn(),
    })).rejects.toMatchObject({ code: 'LOCATION_BACKGROUND_PERMISSION_DENIED' });

    expect(locationModule.startLocationUpdates).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('confirms iOS Always authorization before tracking and marking the driver online', async () => {
    const order = [];
    const locationModule = { startLocationUpdates: jest.fn(() => order.push('location')) };
    const socket = { connected: true, emit: jest.fn((_event, _payload, acknowledge) => { order.push('server'); acknowledge({ success: true }); }) };

    await requestDriverAvailability({
      socket,
      locationModule,
      isOnline: true,
      platform: 'ios',
      hasLocationPermission: async () => true,
      ensureBackgroundLocationAuthorization: async () => { order.push('always'); return true; },
      startAndWaitForLocationFix: async () => locationModule.startLocationUpdates(),
    });

    expect(order).toEqual(['always', 'location', 'server']);
  });

  it('starts location before asking the server to mark the driver online', async () => {
    const order = [];
    const locationModule = { startLocationUpdates: jest.fn(() => order.push('location')) };
    const socket = {
      connected: true,
      emit: jest.fn((_event, _payload, acknowledge) => { order.push('server'); acknowledge({ success: true }); }),
    };

    await requestDriverAvailability({ socket, locationModule, isOnline: true, hasLocationPermission: async () => true, startAndWaitForLocationFix: async () => locationModule.startLocationUpdates() });
    expect(order).toEqual(['location', 'server']);
  });

  it('does not enable availability if location permission is denied', async () => {
    const socket = { connected: true, emit: jest.fn() };
    const locationModule = { startLocationUpdates: jest.fn() };

    await expect(requestDriverAvailability({ socket, locationModule, isOnline: true, hasLocationPermission: async () => false }))
      .rejects.toMatchObject({ code: 'LOCATION_PERMISSION_DENIED' });
    expect(locationModule.startLocationUpdates).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('stops location if the server rejects the availability change', async () => {
    const locationModule = { startLocationUpdates: jest.fn(), stopLocationUpdates: jest.fn() };
    const socket = { connected: true, emit: jest.fn((_event, _payload, acknowledge) => acknowledge({ success: false, error: 'Inactive' })) };

    await expect(requestDriverAvailability({ socket, locationModule, isOnline: true, hasLocationPermission: async () => true, startAndWaitForLocationFix: async () => locationModule.startLocationUpdates() }))
      .rejects.toMatchObject({ code: 'SERVER_REJECTED' });
    expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(1);
  });

  it('keeps location running after an acknowledgement timeout because the server may have committed', async () => {
    jest.useFakeTimers();
    const locationModule = { startLocationUpdates: jest.fn(), stopLocationUpdates: jest.fn() };
    const socket = { connected: true, emit: jest.fn() };
    const pending = requestDriverAvailability({ socket, locationModule, isOnline: true, hasLocationPermission: async () => true, startAndWaitForLocationFix: async () => locationModule.startLocationUpdates() });
    const outcome = pending.then(() => null, (error) => error);
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(8000);
    expect(await outcome).toMatchObject({ code: 'ACK_TIMEOUT' });
    expect(locationModule.stopLocationUpdates).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('stops location immediately when going offline even if the socket is disconnected', async () => {
    const locationModule = { stopLocationUpdates: jest.fn().mockResolvedValue(undefined) };
    const socket = { connected: false, emit: jest.fn() };

    await expect(requestDriverAvailability({ socket, locationModule, isOnline: false }))
      .rejects.toMatchObject({ code: 'SOCKET_DISCONNECTED' });

    expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(1);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('stops location before requesting offline and keeps it stopped after an ACK timeout', async () => {
    jest.useFakeTimers();
    const order = [];
    const locationModule = { stopLocationUpdates: jest.fn(() => order.push('stop')) };
    const socket = { connected: true, emit: jest.fn(() => order.push('server')) };
    const pending = requestDriverAvailability({ socket, locationModule, isOnline: false });
    const outcome = pending.then(() => null, (error) => error);

    await Promise.resolve();
    expect(order).toEqual(['stop', 'server']);
    await jest.advanceTimersByTimeAsync(8000);

    expect(await outcome).toMatchObject({ code: 'ACK_TIMEOUT', serverStateUncertain: true });
    expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('retries an uncertain offline transition safely and stops tracking on each attempt', async () => {
    jest.useFakeTimers();
    const locationModule = { stopLocationUpdates: jest.fn().mockResolvedValue(undefined) };
    let attempts = 0;
    const socket = {
      connected: true,
      emit: jest.fn((_event, _payload, acknowledge) => {
        attempts += 1;
        if (attempts === 2) acknowledge({ success: true });
      }),
    };
    const request = () => requestDriverAvailability({ socket, locationModule, isOnline: false });

    const uncertain = request();
    const firstOutcome = uncertain.then(() => null, (error) => error);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(8000);
    expect(await firstOutcome).toMatchObject({ code: 'ACK_TIMEOUT', serverStateUncertain: true });

    await request();

    expect(socket.emit).toHaveBeenNthCalledWith(1, 'toggle_online', { isOnline: false }, expect.any(Function));
    expect(socket.emit).toHaveBeenNthCalledWith(2, 'toggle_online', { isOnline: false }, expect.any(Function));
    expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('still asks the server to go offline when local cleanup rejects', async () => {
    const locationModule = { stopLocationUpdates: jest.fn().mockRejectedValue(new Error('native service unavailable')) };
    const socket = { connected: true, emit: jest.fn((_event, _payload, acknowledge) => acknowledge({ success: true })) };

    await expect(requestDriverAvailability({ socket, locationModule, isOnline: false })).resolves.toMatchObject({ success: true });

    expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('toggle_online', { isOnline: false }, expect.any(Function));
  });
});

describe('restoreDriverAvailability', () => {
    it('reconciles iOS to offline when Always authorization is unavailable', async () => {
        const socket = { connected: true, emit: jest.fn((_event, _payload, acknowledge) => acknowledge({ success: true })) };
        const locationModule = { startLocationUpdates: jest.fn(), stopLocationUpdates: jest.fn() };

        const result = await restoreDriverAvailability({
            socket,
            isOnline: true,
            platform: 'ios',
            locationModule,
            hasLocationPermission: async () => true,
            ensureBackgroundLocationAuthorization: async () => false,
            startAndWaitForLocationFix: jest.fn(),
        });

        expect(result).toEqual({ serverOnline: false, trackingStarted: false, syncFailed: false });
        expect(locationModule.startLocationUpdates).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith('toggle_online', { isOnline: false }, expect.any(Function));
    });

    it('starts tracking only when the server says online and permission is still granted', async () => {
        const locationModule = { startLocationUpdates: jest.fn() };
        const result = await restoreDriverAvailability({
            socket: {},
            isOnline: true,
            locationModule,
            hasLocationPermission: async () => true,
            startAndWaitForLocationFix: async () => locationModule.startLocationUpdates(),
        });

        expect(result).toEqual({ serverOnline: true, trackingStarted: true, syncFailed: false });
        expect(locationModule.startLocationUpdates).toHaveBeenCalledTimes(1);
    });

    it('asks the server to go offline when location permission was revoked', async () => {
        const socket = { connected: true, emit: jest.fn((event, payload, ack) => ack({ success: true })) };
        const locationModule = { startLocationUpdates: jest.fn(), stopLocationUpdates: jest.fn() };
        const result = await restoreDriverAvailability({
            socket,
            isOnline: true,
            locationModule,
            hasLocationPermission: async () => false,
        });

        expect(result).toEqual({ serverOnline: false, trackingStarted: false, syncFailed: false });
        expect(socket.emit).toHaveBeenCalledWith('toggle_online', { isOnline: false }, expect.any(Function));
        expect(locationModule.startLocationUpdates).not.toHaveBeenCalled();
        expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(1);
    });

    it('keeps the server truth visible if offline reconciliation fails', async () => {
        const socket = { connected: true, emit: jest.fn((event, payload, ack) => ack({ success: false, message: 'offline failed' })) };
        const result = await restoreDriverAvailability({
            socket,
            isOnline: true,
            locationModule: { startLocationUpdates: jest.fn(), stopLocationUpdates: jest.fn() },
            hasLocationPermission: async () => false,
        });

        expect(result).toEqual({ serverOnline: true, trackingStarted: false, syncFailed: true });
    });
});
