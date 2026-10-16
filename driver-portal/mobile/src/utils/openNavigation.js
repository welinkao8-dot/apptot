import { Linking, Platform } from 'react-native';

const parseCoordinate = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return Number.NaN;
  return Number(value);
};

export const buildNavigationUri = (lat, lng) => {
  const latitude = parseCoordinate(lat);
  const longitude = parseCoordinate(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const destination = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving&dir_action=navigate`;
};

const buildFallbackUri = (lat, lng, label, platform) => {
  if (platform === 'ios') {
    return `http://maps.apple.com/?daddr=${encodeURIComponent(`${lat},${lng}`)}&dirflg=d`;
  }
  return `geo:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`;
};

export const openNavigationApp = async (lat, lng, label = 'Destino') => {
  const uri = buildNavigationUri(lat, lng, label);
  if (!uri) return { ok: false, reason: 'invalid_coordinates' };

  try {
    await Linking.openURL(uri);
    return { ok: true };
  } catch {
    try {
      await Linking.openURL(buildFallbackUri(Number(lat), Number(lng), label, Platform.OS));
      return { ok: true, fallback: true };
    } catch {
      return { ok: false, reason: 'navigation_unavailable' };
    }
  }
};
