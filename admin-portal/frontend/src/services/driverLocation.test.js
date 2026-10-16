import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDriverLocation, toDriverMapPosition } from './driverLocation.js';

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
