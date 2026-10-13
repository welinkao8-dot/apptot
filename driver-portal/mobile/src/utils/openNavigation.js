import { Linking, Platform } from 'react-native';

export const buildNavigationUri = (lat, lng, label = 'Destino', platform = Platform.OS) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  if (platform === 'ios') return `maps:0,0?q=${latitude},${longitude}(${encodeURIComponent(label)})`;
  if (platform === 'android') return `geo:0,0?q=${latitude},${longitude}(${encodeURIComponent(label)})`;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
};

export const openNavigationApp = async (lat, lng, label = 'Destino') => {
  const uri = buildNavigationUri(lat, lng, label);
  if (!uri) return { ok: false, reason: 'invalid_coordinates' };

  try {
    await Linking.openURL(uri);
    return { ok: true };
  } catch {
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}&travelmode=driving`;
    try {
      await Linking.openURL(fallback);
      return { ok: true, fallback: true };
    } catch {
      return { ok: false, reason: 'navigation_unavailable' };
    }
  }
};
