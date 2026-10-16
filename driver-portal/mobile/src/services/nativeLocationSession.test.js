import { clearNativeLocationSession, syncNativeLocationSession } from './nativeLocationSession';

describe('syncNativeLocationSession', () => {
    it('configures uploads only for an active driver', async () => {
        const locationModule = {
            configureLocationUpload: jest.fn().mockResolvedValue(undefined),
            stopLocationUpdates: jest.fn(),
            clearLocationUploadConfig: jest.fn(),
        };

        await syncNativeLocationSession({ locationModule, user: { status: 'active' }, token: 'session-token', apiUrl: 'http://localhost:3004' });

        expect(locationModule.configureLocationUpload).toHaveBeenCalledWith(expect.any(String), 'session-token');
        expect(locationModule.stopLocationUpdates).not.toHaveBeenCalled();
        expect(locationModule.clearLocationUploadConfig).not.toHaveBeenCalled();
    });

    it.each(['pending', 'pending_docs', 'suspended', 'blocked'])('clears native credentials for %s accounts', async (status) => {
        const locationModule = {
            configureLocationUpload: jest.fn(),
            stopLocationUpdates: jest.fn().mockResolvedValue(undefined),
            clearLocationUploadConfig: jest.fn().mockResolvedValue(undefined),
        };

        await syncNativeLocationSession({ locationModule, user: { status }, token: 'session-token', apiUrl: 'http://localhost:3004' });

        expect(locationModule.configureLocationUpload).not.toHaveBeenCalled();
        expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(1);
        expect(locationModule.clearLocationUploadConfig).toHaveBeenCalledTimes(1);
    });

    it('clears native credentials when an active account has no token', async () => {
        const locationModule = {
            configureLocationUpload: jest.fn(),
            stopLocationUpdates: jest.fn().mockResolvedValue(undefined),
            clearLocationUploadConfig: jest.fn().mockResolvedValue(undefined),
        };

        await syncNativeLocationSession({ locationModule, user: { status: 'active' }, token: null, apiUrl: 'http://localhost:3004' });

        expect(locationModule.configureLocationUpload).not.toHaveBeenCalled();
        expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(1);
        expect(locationModule.clearLocationUploadConfig).toHaveBeenCalledTimes(1);
    });

    it('clears native credentials even when stopping tracking fails, and is safe to repeat', async () => {
        const locationModule = {
            configureLocationUpload: jest.fn(),
            stopLocationUpdates: jest.fn().mockRejectedValue(new Error('service unavailable')),
            clearLocationUploadConfig: jest.fn().mockResolvedValue(undefined),
        };

        await expect(syncNativeLocationSession({ locationModule, user: { status: 'suspended' }, token: 'session-token', apiUrl: 'http://localhost:3004' })).resolves.toBeDefined();
        await expect(syncNativeLocationSession({ locationModule, user: { status: 'suspended' }, token: 'session-token', apiUrl: 'http://localhost:3004' })).resolves.toBeDefined();

        expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(2);
        expect(locationModule.clearLocationUploadConfig).toHaveBeenCalledTimes(2);
    });

    it('keeps legacy accounts with no status eligible for uploads', async () => {
        const locationModule = { configureLocationUpload: jest.fn().mockResolvedValue(undefined) };

        await syncNativeLocationSession({ locationModule, user: {}, token: 'session-token', apiUrl: 'http://localhost:3004' });

        expect(locationModule.configureLocationUpload).toHaveBeenCalledWith(expect.any(String), 'session-token');
    });

    it('clears a previous native session when configuring a replacement session fails', async () => {
        const configurationError = new Error('native service unavailable');
        const locationModule = {
            configureLocationUpload: jest.fn()
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(configurationError),
            stopLocationUpdates: jest.fn().mockResolvedValue(undefined),
            clearLocationUploadConfig: jest.fn().mockResolvedValue(undefined),
        };

        await syncNativeLocationSession({
            locationModule,
            user: { status: 'active' },
            token: 'old-session-token',
            apiUrl: 'http://localhost:3004',
        });
        const result = await syncNativeLocationSession({
            locationModule,
            user: { status: 'active' },
            token: 'new-session-token',
            apiUrl: 'http://localhost:3004',
        });

        expect(result.configured).toBe(false);
        expect(result.errors).toContain(configurationError);
        expect(locationModule.configureLocationUpload).toHaveBeenNthCalledWith(1, expect.any(String), 'old-session-token');
        expect(locationModule.configureLocationUpload).toHaveBeenNthCalledWith(2, expect.any(String), 'new-session-token');
        expect(locationModule.stopLocationUpdates).toHaveBeenCalledTimes(1);
        expect(locationModule.clearLocationUploadConfig).toHaveBeenCalledTimes(1);
    });

    it('runs logout cleanup after an in-flight native configuration completes', async () => {
        let finishConfiguration;
        const calls = [];
        const locationModule = {
            configureLocationUpload: jest.fn(() => {
                calls.push('configure-start');
                return new Promise((resolve) => {
                    finishConfiguration = () => {
                        calls.push('configure-finish');
                        resolve();
                    };
                });
            }),
            stopLocationUpdates: jest.fn(async () => calls.push('stop')),
            clearLocationUploadConfig: jest.fn(async () => calls.push('clear')),
        };

        const configuration = syncNativeLocationSession({ locationModule, user: { status: 'active' }, token: 'session-token', apiUrl: 'http://localhost:3004' });
        await Promise.resolve();
        const cleanup = clearNativeLocationSession(locationModule);
        await Promise.resolve();

        expect(calls).toEqual(['configure-start']);
        finishConfiguration();
        await Promise.all([configuration, cleanup]);

        expect(calls).toEqual(['configure-start', 'configure-finish', 'stop', 'clear']);
    });
});
