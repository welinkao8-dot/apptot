jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn(), canOpenURL: jest.fn() },
  Platform: { OS: 'android', select: choices => choices.android },
}));

import { Linking, Platform } from 'react-native';
import { buildNavigationUri, openNavigationApp } from './openNavigation';

describe('openNavigationApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  it('opens directions to valid Android coordinates', async () => {
    Linking.openURL.mockResolvedValueOnce(true);
    await openNavigationApp(-8.84, 13.29, 'Local de Recolha');
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=-8.84%2C13.29&travelmode=driving&dir_action=navigate');
  });

  it('requests a navigation action with the current device position as origin', () => {
    const uri = buildNavigationUri(-8.84, 13.29);
    expect(uri).toContain('dir_action=navigate');
    expect(uri).not.toContain('origin=');
  });

  it('rejects invalid coordinates instead of opening a map at a fake location', async () => {
    await expect(openNavigationApp(NaN, 13.29)).resolves.toEqual({ ok: false, reason: 'invalid_coordinates' });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it.each([null, '', '   ', false])('rejects missing latitude input %p instead of treating it as zero', (latitude) => {
    expect(buildNavigationUri(latitude, 13.29)).toBeNull();
  });

  it('does not open navigation when destination coordinates are missing', async () => {
    await expect(openNavigationApp(null, 13.29)).resolves.toEqual({ ok: false, reason: 'invalid_coordinates' });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it.each([null, '', '   ', false])('rejects missing longitude input %p instead of treating it as zero', (longitude) => {
    expect(buildNavigationUri(-8.84, longitude)).toBeNull();
  });

  it('allows zero coordinates when they are valid', async () => {
    Linking.openURL.mockResolvedValueOnce(true);
    await expect(openNavigationApp(0, 0)).resolves.toMatchObject({ ok: true });
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=0%2C0&travelmode=driving&dir_action=navigate');
  });

  it('falls back to a geo URI if the directions URL cannot be opened', async () => {
    Linking.openURL.mockRejectedValueOnce(new Error('directions failed')).mockResolvedValueOnce(true);
    await expect(openNavigationApp(-8.84, 13.29, 'Local A & B')).resolves.toEqual({ ok: true, fallback: true });
    expect(Linking.openURL).toHaveBeenLastCalledWith('geo:0,0?q=-8.84,13.29(Local%20A%20%26%20B)');
  });

  it('falls back to Apple Maps on iOS after the directions URL fails', async () => {
    Platform.OS = 'ios';
    Linking.openURL.mockRejectedValueOnce(new Error('directions failed')).mockResolvedValueOnce(true);

    await expect(openNavigationApp(-8.84, 13.29, 'Ponto A & B')).resolves.toEqual({ ok: true, fallback: true });

    expect(Linking.openURL).toHaveBeenNthCalledWith(1, 'https://www.google.com/maps/dir/?api=1&destination=-8.84%2C13.29&travelmode=driving&dir_action=navigate');
    expect(Linking.openURL).toHaveBeenNthCalledWith(2, 'http://maps.apple.com/?daddr=-8.84%2C13.29&dirflg=d');
  });

  it('reports failure when directions and geo fallback cannot open', async () => {
    Linking.openURL.mockRejectedValueOnce(new Error('directions failed')).mockRejectedValueOnce(new Error('fallback failed'));
    await expect(openNavigationApp(-8.84, 13.29)).resolves.toEqual({ ok: false, reason: 'navigation_unavailable' });
    expect(Linking.openURL).toHaveBeenCalledTimes(2);
  });
});
