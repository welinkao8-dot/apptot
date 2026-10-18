import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLocationAge, loadDriverLocation, resolveDriverLocation, toDriverMapPosition } from './driverLocation.js';
import { createRequestSequence } from './adminDriversList.js';

test('uses only finite coordinates reported by the driver API', () => {
  assert.deepEqual(toDriverMapPosition({ current_lat: -8.9, current_lng: 13.2 }), [-8.9, 13.2]);
  assert.equal(toDriverMapPosition({ current_lat: null, current_lng: null }), null);
  assert.equal(toDriverMapPosition({ current_lat: 'invalid', current_lng: 13.2 }), null);
  assert.equal(toDriverMapPosition({ current_lat: 91, current_lng: 13.2 }), null);
});

test('classifies valid coordinates as fresh or stale using their server timestamp', () => {
  const now = Date.parse('2026-10-15T10:00:00.000Z');
  assert.deepEqual(resolveDriverLocation({
    current_lat: -8.9,
    current_lng: 13.2,
    current_accuracy: 7.4,
    last_location_update: '2026-10-15T09:59:45.000Z',
  }, { now }), {
    state: 'fresh',
    position: [-8.9, 13.2],
    updatedAt: '2026-10-15T09:59:45.000Z',
    ageMs: 15000,
    accuracyMeters: 7.4,
  });

  assert.equal(resolveDriverLocation({
    current_lat: -8.9,
    current_lng: 13.2,
    current_accuracy: 9,
    last_location_update: '2026-10-15T09:58:00.000Z',
  }, { now }).state, 'stale');
});

test('never treats missing, invalid, or future timestamps as a fresh GPS fix', () => {
  const now = Date.parse('2026-10-15T10:00:00.000Z');
  for (const last_location_update of [null, 'not-a-date', '2026-10-15T10:10:00.000Z']) {
    assert.equal(resolveDriverLocation({
      current_lat: -8.9,
      current_lng: 13.2,
      last_location_update,
    }, { now }).state, 'unknown');
  }
});

test('does not return a mappable position when coordinates are missing or out of range', () => {
  const now = Date.parse('2026-10-15T10:00:00.000Z');
  for (const driver of [
    { current_lat: null, current_lng: 13.2, last_location_update: '2026-10-15T09:59:55.000Z' },
    { current_lat: 91, current_lng: 13.2, last_location_update: '2026-10-15T09:59:55.000Z' },
  ]) {
    assert.deepEqual(resolveDriverLocation(driver, { now }), {
      state: 'unavailable',
      position: null,
      updatedAt: null,
      ageMs: null,
      accuracyMeters: null,
    });
  }
});

test('formata a idade da localização em segundos, minutos, horas, dias, meses e anos', () => {
  assert.equal(formatLocationAge(null), 'sem horário confiável');
  assert.equal(formatLocationAge(-100), 'sem horário confiável');
  assert.equal(formatLocationAge(1000), 'há instantes');
  assert.equal(formatLocationAge(25_000), 'há 25 s');
  assert.equal(formatLocationAge(3 * 60_000), 'há 3 min');
  assert.equal(formatLocationAge(2 * 3600_000), 'há 2 h');
  assert.equal(formatLocationAge(2 * 3600_000 + 15 * 60_000), 'há 2 h 15 min');
  assert.equal(formatLocationAge(5 * 86400_000), 'há 5 dias');
  assert.equal(formatLocationAge(5 * 86400_000 + 4 * 3600_000), 'há 5 dias e 4 h');
  // 156493 minutos = ~108 dias = 3 meses e 18 dias
  assert.equal(formatLocationAge(156493 * 60_000), 'há 3 meses e 18 dias');
  assert.equal(formatLocationAge(400 * 86400_000), 'há 1 ano e 1 mês');
});

test('ignores an older driver location response when another profile was requested later', async () => {
  const requests = createRequestSequence();
  let resolveFirst;
  const timestamp = new Date(Date.now() - 5_000).toISOString();
  const adminApi = {
    get: (path) => path.endsWith('/driver-a')
      ? new Promise((resolve) => { resolveFirst = resolve; })
      : Promise.resolve({ data: { id: 'driver-b', current_lat: -8.84, current_lng: 13.23, last_location_update: timestamp } }),
  };

  const first = loadDriverLocation(adminApi, 'driver-a', requests);
  const second = loadDriverLocation(adminApi, 'driver-b', requests);
  const secondResult = await second;
  resolveFirst({ data: { id: 'driver-a', current_lat: -8.83, current_lng: 13.22, last_location_update: timestamp } });

  assert.equal(secondResult.state, 'fresh');
  assert.deepEqual(secondResult.position, [-8.84, 13.23]);
  assert.deepEqual(await first, { state: 'stale' });
});

test('shows an error state when the driver location response does not match the requested profile', async () => {
  const requests = createRequestSequence();
  const adminApi = { get: async () => ({ data: { id: 'different-driver', current_lat: 0, current_lng: 0 } }) };

  assert.deepEqual(await loadDriverLocation(adminApi, 'driver-a', requests), {
    state: 'error', position: null, updatedAt: null, ageMs: null, accuracyMeters: null,
  });
});
