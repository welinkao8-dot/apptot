import { isImplausibleLocationJump } from './location-validation';

describe('isImplausibleLocationJump', () => {
  it('allows realistic movement over the elapsed GPS interval', () => {
    expect(isImplausibleLocationJump(
      { lat: -8.84, lng: 13.29, timestamp: 1_000 },
      { lat: -8.8405, lng: 13.29, timestamp: 11_000 },
    )).toBe(false);
  });

  it('rejects a city-scale teleport within seconds', () => {
    expect(isImplausibleLocationJump(
      { lat: -8.84, lng: 13.29, timestamp: 1_000 },
      { lat: -8.90, lng: 13.29, timestamp: 6_000 },
    )).toBe(true);
  });

  it('does not compare fixes when the previous measurement is absent or older', () => {
    expect(isImplausibleLocationJump(null, { lat: -8.84, lng: 13.29, timestamp: 6_000 })).toBe(false);
    expect(isImplausibleLocationJump(
      { lat: -8.84, lng: 13.29, timestamp: 6_000 },
      { lat: -8.90, lng: 13.29, timestamp: 1_000 },
    )).toBe(false);
  });
});
