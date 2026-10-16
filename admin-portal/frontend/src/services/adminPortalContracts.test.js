import test from 'node:test';
import assert from 'node:assert/strict';
import { bindAdminDashboardEvents, bindAdminSocketAuth, getAdminSocketOptions, hasReceiptFile } from './adminPortalContracts.js';

test('uses the admin socket token handshake and actual gateway event names', () => {
        const socket = { on: (...args) => socket.onCalls.push(args), off: (...args) => socket.offCalls.push(args), onCalls: [], offCalls: [] };
        const refresh = () => {};
        assert.deepEqual(getAdminSocketOptions('jwt'), { auth: { token: 'jwt' } });
        const unbind = bindAdminDashboardEvents(socket, { onDriverStatusUpdated: refresh, onPricingUpdated: refresh });
        assert.deepEqual(socket.onCalls.map(([event]) => event), ['driver_status_updated', 'pricing_updated']);
        unbind();
        assert.equal(socket.offCalls.length, 2);
});

test('expires admin auth only for explicit socket auth rejection, not transport failures', () => {
        const handlers = new Map();
        const socket = {
                on: (event, handler) => handlers.set(event, handler),
                off: (event, handler) => { if (handlers.get(event) === handler) handlers.delete(event); },
        };
        let expired = 0;
        const unbind = bindAdminSocketAuth(socket, () => { expired += 1; });
        handlers.get('connect_error')({ message: 'websocket error' });
        handlers.get('connect_error')({ message: 'Authentication failed' });
        handlers.get('disconnect')('transport close');
        handlers.get('disconnect')('io server disconnect');
        assert.equal(expired, 2);
        unbind();
        assert.equal(handlers.has('connect_error'), false);
        assert.equal(handlers.has('disconnect'), false);
});

test('only offers receipt download when a file URL exists', () => {
        assert.equal(hasReceiptFile(null), false);
        assert.equal(hasReceiptFile('  '), false);
        assert.equal(hasReceiptFile('https://example.test/receipt.pdf'), true);
});
