import { getOfferSecondsRemaining } from './offerExpiry';

describe('getOfferSecondsRemaining', () => {
  it('returns seconds for a valid server expiry', () => {
    expect(getOfferSecondsRemaining('2026-10-13T12:00:10.000Z', Date.parse('2026-10-13T12:00:00.000Z'))).toBe(10);
  });

  it('returns zero for an expired offer', () => {
    expect(getOfferSecondsRemaining('2026-10-13T11:59:00.000Z', Date.parse('2026-10-13T12:00:00.000Z'))).toBe(0);
  });

  it('returns null when the offer has no valid server expiry', () => {
    expect(getOfferSecondsRemaining(null)).toBeNull();
    expect(getOfferSecondsRemaining('not-a-date')).toBeNull();
  });
});
