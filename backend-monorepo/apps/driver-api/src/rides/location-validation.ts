type LocationFix = { lat: number; lng: number; timestamp: number };

const distanceMeters = (a: LocationFix, b: LocationFix) => {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const firstLat = radians(a.lat);
  const secondLat = radians(b.lat);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export const isImplausibleLocationJump = (previous?: LocationFix | null, next?: LocationFix | null): boolean => {
  if (!previous || !next || next.timestamp <= previous.timestamp) return false;
  const elapsedSeconds = (next.timestamp - previous.timestamp) / 1000;
  const allowedMeters = 100 + elapsedSeconds * 45;
  return distanceMeters(previous, next) > allowedMeters;
};
