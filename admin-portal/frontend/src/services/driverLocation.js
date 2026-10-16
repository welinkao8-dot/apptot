// The driver uploads GPS every 5 s, but the API persists an admin-visible fix at most every 30 s.
// Ninety seconds marks the feed stale before dispatch's 120-second eligibility cutoff.
export const DRIVER_LOCATION_STALE_AFTER_MS = 90_000;

export const toDriverMapPosition = (driver) => {
  const rawLat = driver?.current_lat;
  const rawLng = driver?.current_lng;
  if (rawLat == null || rawLng == null) return null;

  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return [lat, lng];
};

export function resolveDriverLocation(
  driver,
  { now = Date.now(), staleAfterMs = DRIVER_LOCATION_STALE_AFTER_MS } = {},
) {
  const position = toDriverMapPosition(driver);
  const accuracy = Number(driver?.current_accuracy);
  const accuracyMeters = driver?.current_accuracy != null && Number.isFinite(accuracy) && accuracy >= 0
    ? accuracy
    : null;
  if (!position) {
    return { state: 'unavailable', position: null, updatedAt: null, ageMs: null, accuracyMeters: null };
  }

  const timestamp = Date.parse(driver?.last_location_update);
  if (!Number.isFinite(timestamp) || timestamp > now) {
    return {
      state: 'unknown',
      position,
      updatedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
      ageMs: null,
      accuracyMeters,
    };
  }

  const ageMs = now - timestamp;
  return {
    state: ageMs > staleAfterMs ? 'stale' : 'fresh',
    position,
    updatedAt: new Date(timestamp).toISOString(),
    ageMs,
    accuracyMeters,
  };
}

export function formatLocationAge(ageMs) {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'sem horário confiável';
  if (ageMs < 60_000) return `há ${Math.max(1, Math.floor(ageMs / 1000))} s`;
  return `há ${Math.floor(ageMs / 60_000)} min`;
}
