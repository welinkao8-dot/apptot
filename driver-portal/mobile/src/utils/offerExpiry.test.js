import { getOfferSecondsRemaining, isOfferExpired } from './offerExpiry';

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

describe('isOfferExpired', () => {
  it('blocks acceptance at or after the server expiry time', () => {
    const now = Date.parse('2026-10-13T12:00:00.000Z');

    expect(isOfferExpired('2026-10-13T11:59:59.999Z', now)).toBe(true);
    expect(isOfferExpired('2026-10-13T12:00:00.000Z', now)).toBe(true);
  });

  it('keeps an unexpired offer eligible for a server-side acceptance attempt', () => {
    expect(isOfferExpired('2026-10-13T12:00:01.000Z', Date.parse('2026-10-13T12:00:00.000Z'))).toBe(false);
  });

  it('leaves offers without a parseable expiry to server-side validation', () => {
    expect(isOfferExpired(null)).toBe(false);
    expect(isOfferExpired('not-a-date')).toBe(false);
  });
});
