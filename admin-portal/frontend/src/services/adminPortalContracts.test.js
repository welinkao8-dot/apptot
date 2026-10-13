import test from 'node:test';
import assert from 'node:assert/strict';
import { bindAdminDashboardEvents, getAdminSocketOptions, hasReceiptFile } from './adminPortalContracts.js';

test('uses the admin socket token handshake and actual gateway event names', () => {
        const socket = { on: (...args) => socket.onCalls.push(args), off: (...args) => socket.offCalls.push(args), onCalls: [], offCalls: [] };
        const refresh = () => {};
        assert.deepEqual(getAdminSocketOptions('jwt'), { auth: { token: 'jwt' } });
        const unbind = bindAdminDashboardEvents(socket, { onDriverStatusUpdated: refresh, onPricingUpdated: refresh });
        assert.deepEqual(socket.onCalls.map(([event]) => event), ['driver_status_updated', 'pricing_updated']);
        unbind();
        assert.equal(socket.offCalls.length, 2);
});

test('only offers receipt download when a file URL exists', () => {
        assert.equal(hasReceiptFile(null), false);
        assert.equal(hasReceiptFile('  '), false);
        assert.equal(hasReceiptFile('https://example.test/receipt.pdf'), true);
});
