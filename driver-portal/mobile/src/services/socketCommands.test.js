import { emitSocketCommand } from './socketCommands';

describe('emitSocketCommand', () => {
    it('resolves only after a successful server acknowledgement', async () => {
        const socket = { connected: true, emit: jest.fn((_event, _payload, acknowledge) => acknowledge({ success: true, value: 3 })) };
        await expect(emitSocketCommand(socket, 'toggle_online', { isOnline: true })).resolves.toEqual({ success: true, value: 3 });
    });

    it('rejects a server-declared failure', async () => {
        const socket = { connected: true, emit: jest.fn((_event, _payload, acknowledge) => acknowledge({ success: false, error: 'Forbidden' })) };
        await expect(emitSocketCommand(socket, 'toggle_online', { isOnline: true })).rejects.toMatchObject({ code: 'SERVER_REJECTED' });
    });

    it('rejects when the server does not acknowledge before the timeout', async () => {
        jest.useFakeTimers();
        try {
            const socket = { connected: true, emit: jest.fn() };
            const result = emitSocketCommand(socket, 'confirm_cash_payment', {}, 50);
            jest.advanceTimersByTime(50);
            await expect(result).rejects.toMatchObject({ code: 'ACK_TIMEOUT' });
        } finally {
            jest.useRealTimers();
        }
    });
});
