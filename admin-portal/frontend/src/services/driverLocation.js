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

export async function loadDriverLocation(adminApi, driverId, requests) {
  const requestId = requests.begin();
  try {
    const response = await adminApi.get(`/admin/drivers/${encodeURIComponent(driverId)}`);
    if (!requests.isCurrent(requestId)) return { state: 'stale' };
    const driver = response?.data;
    if (!driver || typeof driver !== 'object' || driver.id !== driverId) {
      return { state: 'error', position: null, updatedAt: null, ageMs: null, accuracyMeters: null };
    }
    return { ...resolveDriverLocation(driver), driver };
  } catch {
    return requests.isCurrent(requestId)
      ? { state: 'error', position: null, updatedAt: null, ageMs: null, accuracyMeters: null }
      : { state: 'stale' };
  }
}

export function formatLocationAge(ageMs) {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'sem horário confiável';

  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) {
    return seconds <= 1 ? 'há instantes' : `há ${seconds} s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `há ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) {
    if (remMinutes === 0) return hours === 1 ? 'há 1 h' : `há ${hours} h`;
    return `há ${hours} h ${remMinutes} min`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days < 30) {
    const dayLabel = days === 1 ? '1 dia' : `${days} dias`;
    if (remHours === 0) return `há ${dayLabel}`;
    return `há ${dayLabel} e ${remHours} h`;
  }

  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (months < 12) {
    const monthLabel = months === 1 ? '1 mês' : `${months} meses`;
    if (remDays === 0) return `há ${monthLabel}`;
    return `há ${monthLabel} e ${remDays} ${remDays === 1 ? 'dia' : 'dias'}`;
  }

  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days % 365) / 30);
  const yearLabel = years === 1 ? '1 ano' : `${years} anos`;
  if (remMonths === 0) return `há ${yearLabel}`;
  return `há ${yearLabel} e ${remMonths} ${remMonths === 1 ? 'mês' : 'meses'}`;
}
