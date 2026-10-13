import { drawSelectedQuoteRoute, isQuoteExpired } from './quoteSelection';

describe('drawSelectedQuoteRoute', () => {
  it('draws geometry belonging to the service the customer selected', () => {
    const map = { drawRoute: jest.fn() };
    const selected = { routePolyline: 'scooter-route' };

    expect(drawSelectedQuoteRoute(selected, map)).toBe(true);
    expect(map.drawRoute).toHaveBeenCalledWith('scooter-route');
  });

  it('does not draw a route when the selected quote has no geometry', () => {
    const map = { drawRoute: jest.fn() };

    expect(drawSelectedQuoteRoute({ routePolyline: null }, map)).toBe(false);
    expect(map.drawRoute).not.toHaveBeenCalled();
  });
});

describe('isQuoteExpired', () => {
    it('treats missing or elapsed expiry as expired and future expiry as valid', () => {
        expect(isQuoteExpired({}, 1000)).toBe(true);
        expect(isQuoteExpired({ expiresAt: new Date(999).toISOString() }, 1000)).toBe(true);
        expect(isQuoteExpired({ expiresAt: new Date(1001).toISOString() }, 1000)).toBe(false);
    });
});
