import { Linking, Platform } from 'react-native';

/**
 * Opens the native device navigation chooser with the specified coordinates.
 * On Android, this triggers the system dialog to let the user select between
 * Google Maps, Waze, HERE WeGo, or any other installed navigation app.
 * 
 * @param {number} lat - Target latitude
 * @param {number} lng - Target longitude
 * @param {string} label - Name/Label for the destination point
 */
export const openNavigationApp = (lat, lng, label = 'Destino') => {
  if (!lat || !lng) {
    console.warn('openNavigationApp: Missing coordinates', { lat, lng });
    return;
  }

  // Use standard mapping schemes to trigger the system's app chooser dialog
  const scheme = Platform.select({
    ios: `maps:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`,
    android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`,
  });

  Linking.openURL(scheme).catch(err => {
    console.error('Failed to open map scheme, trying Google Maps web fallback:', err);
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(webUrl).catch(errFallback => {
      console.error('Failed to open fallback URL:', errFallback);
    });
  });
};
