import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLiveOpsResults } from './liveOpsData.js';

const emptyPrevious = {
  drivers: [],
  activeTrips: [],
  lastUpdated: { drivers: null, trips: null },
};

const trip = (id, status) => ({ id, status });

test('updates each LiveOps resource independently and keeps only active trips', () => {
  const result = resolveLiveOpsResults([
    { status: 'fulfilled', value: { data: [{ id: 'd1' }] } },
    { status: 'fulfilled', value: { data: [trip('active', 'ongoing'), trip('done', 'completed')] } },
  ], emptyPrevious, new Date('2026-10-15T10:00:00Z'));

  assert.deepEqual(result.drivers, [{ id: 'd1' }]);
  assert.deepEqual(result.activeTrips, [trip('active', 'ongoing')]);
  assert.deepEqual(result.errors, { drivers: null, trips: null });
  assert.deepEqual(result.lastUpdated, { drivers: '2026-10-15T10:00:00.000Z', trips: '2026-10-15T10:00:00.000Z' });
});

test('a failed resource preserves its last good data and timestamp while another succeeds', () => {
  const previous = {
    drivers: [{ id: 'old-driver' }],
    activeTrips: [trip('old-trip', 'accepted')],
    lastUpdated: { drivers: '2026-10-15T09:00:00.000Z', trips: '2026-10-15T09:00:00.000Z' },
  };
  const result = resolveLiveOpsResults([
    { status: 'rejected', reason: new Error('offline') },
    { status: 'fulfilled', value: { data: [] } },
  ], previous, new Date('2026-10-15T10:00:00Z'));

  assert.deepEqual(result.drivers, previous.drivers);
  assert.deepEqual(result.activeTrips, []);
  assert.equal(result.errors.drivers, 'Falha ao carregar motoristas. Tente novamente.');
  assert.equal(result.errors.trips, null);
  assert.equal(result.lastUpdated.drivers, previous.lastUpdated.drivers);
  assert.equal(result.lastUpdated.trips, '2026-10-15T10:00:00.000Z');
});

test('malformed successful responses are errors, not empty lists', () => {
  const result = resolveLiveOpsResults([
    { status: 'fulfilled', value: { data: { items: [] } } },
    { status: 'fulfilled', value: { data: null } },
  ], emptyPrevious, new Date('2026-10-15T10:00:00Z'));

  assert.deepEqual(result.drivers, []);
  assert.deepEqual(result.activeTrips, []);
  assert.equal(result.errors.drivers, 'Resposta inválida ao carregar motoristas.');
  assert.equal(result.errors.trips, 'Resposta inválida ao carregar corridas.');
  assert.deepEqual(result.lastUpdated, emptyPrevious.lastUpdated);
});
