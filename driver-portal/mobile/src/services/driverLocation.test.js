import { flushLatestDriverLocation, startAndWaitForLocationFix } from './driverLocation';

function createEmitter() {
    const listeners = new Set();
    return {
        addListener: jest.fn((event, listener) => {
            listeners.add(listener);
            return { remove: () => listeners.delete(listener) };
        }),
        emit: (location) => listeners.forEach((listener) => listener(location)),
        listenerCount: () => listeners.size,
    };
}

const validFix = { coords: { latitude: -8.8383, longitude: 13.2344, accuracy: 24, timestamp: Date.now() } };

describe('startAndWaitForLocationFix', () => {
    it('subscribes before starting and resolves on a valid GPS fix', async () => {
        const eventEmitter = createEmitter();
        const locationModule = { startLocationUpdates: jest.fn(() => eventEmitter.emit(validFix)) };

        await expect(startAndWaitForLocationFix({ locationModule, eventEmitter, timeoutMs: 100 }))
            .resolves.toEqual(validFix);

        expect(eventEmitter.addListener).toHaveBeenCalledWith('onLocationUpdate', expect.any(Function));
        expect(locationModule.startLocationUpdates).toHaveBeenCalledTimes(1);
        expect(eventEmitter.listenerCount()).toBe(0);
    });

    it('ignores invalid coordinates and rejects if no valid fix arrives before timeout', async () => {
        jest.useFakeTimers();
        const eventEmitter = createEmitter();
        const pending = startAndWaitForLocationFix({
            locationModule: { startLocationUpdates: jest.fn() },
            eventEmitter,
            timeoutMs: 100,
        });
        eventEmitter.emit({ coords: { latitude: 999, longitude: 999, accuracy: 1, timestamp: Date.now() } });
        jest.advanceTimersByTime(100);

        await expect(pending).rejects.toMatchObject({ code: 'LOCATION_FIX_TIMEOUT' });
        expect(eventEmitter.listenerCount()).toBe(0);
        jest.useRealTimers();
    });
});

describe('flushLatestDriverLocation', () => {
    it('does not queue location while the socket is disconnected', async () => {
        const socket = { connected: false, emit: jest.fn() };
        const locationModule = { getLatestLocation: jest.fn().mockResolvedValue(validFix) };

        await expect(flushLatestDriverLocation({ socket, locationModule })).resolves.toBe(false);
        expect(locationModule.getLatestLocation).not.toHaveBeenCalled();
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it('sends the last valid native fix after the socket reconnects', async () => {
        const socket = { connected: true, emit: jest.fn() };
        const locationModule = { getLatestLocation: jest.fn().mockResolvedValue(validFix) };

        await expect(flushLatestDriverLocation({ socket, locationModule })).resolves.toBe(true);
        expect(socket.emit).toHaveBeenCalledWith('update_location', {
            lat: validFix.coords.latitude,
            lng: validFix.coords.longitude,
            accuracy: validFix.coords.accuracy,
            heading: validFix.coords.heading,
            timestamp: validFix.coords.timestamp,
        });
    });

    it('does not send an invalid or stale native fix', async () => {
        const socket = { connected: true, emit: jest.fn() };
        const locationModule = { getLatestLocation: jest.fn().mockResolvedValue({
            coords: { ...validFix.coords, timestamp: Date.now() - 180_000 },
        }) };

        await expect(flushLatestDriverLocation({ socket, locationModule })).resolves.toBe(false);
        expect(socket.emit).not.toHaveBeenCalled();
    });
});
