export type DispatchPoint = { id: string; lat: number | null; lng: number | null };

const radians = (degrees: number) => degrees * Math.PI / 180;

export function rankDriversByDistance(origin: { lat: number; lng: number }, drivers: DispatchPoint[]) {
  const valid = drivers.filter((driver): driver is { id: string; lat: number; lng: number } =>
    Number.isFinite(driver.lat) && Number.isFinite(driver.lng)
    && driver.lat! >= -18.1 && driver.lat! <= -4.3
    && driver.lng! >= 11.6 && driver.lng! <= 24.1,
  );
  return valid.map((driver) => {
    const dLat = radians(driver.lat - origin.lat);
    const dLng = radians(driver.lng - origin.lng);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(radians(origin.lat)) * Math.cos(radians(driver.lat)) * Math.sin(dLng / 2) ** 2;
    return { ...driver, distanceKm: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}
