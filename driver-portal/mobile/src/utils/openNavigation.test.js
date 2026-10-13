jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn(), canOpenURL: jest.fn() },
  Platform: { OS: 'android', select: choices => choices.android },
}));

import { Linking } from 'react-native';
import { openNavigationApp } from './openNavigation';

describe('openNavigationApp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens directions to valid Android coordinates', async () => {
    Linking.openURL.mockResolvedValueOnce(true);
    await openNavigationApp(-8.84, 13.29, 'Local de Recolha');
    expect(Linking.openURL).toHaveBeenCalledWith('geo:0,0?q=-8.84,13.29(Local%20de%20Recolha)');
  });

  it('rejects invalid coordinates instead of opening a map at a fake location', async () => {
    await expect(openNavigationApp(NaN, 13.29)).resolves.toEqual({ ok: false, reason: 'invalid_coordinates' });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('allows zero coordinates when they are valid', async () => {
    Linking.openURL.mockResolvedValueOnce(true);
    await expect(openNavigationApp(0, 0)).resolves.toMatchObject({ ok: true });
    expect(Linking.openURL).toHaveBeenCalledWith('geo:0,0?q=0,0(Destino)');
  });

  it('reports failure when native and web navigation cannot open', async () => {
    Linking.openURL.mockRejectedValueOnce(new Error('native failed')).mockRejectedValueOnce(new Error('web failed'));
    await expect(openNavigationApp(-8.84, 13.29)).resolves.toEqual({ ok: false, reason: 'navigation_unavailable' });
    expect(Linking.openURL).toHaveBeenCalledTimes(2);
  });
});
