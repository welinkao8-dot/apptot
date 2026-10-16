import { drawSelectedQuoteRoute, isQuoteExpired, mergeQuotesWithServices } from './quoteSelection';

describe('drawSelectedQuoteRoute', () => {
  it('draws geometry belonging to the service the customer selected', () => {
    const map = { drawRoute: jest.fn() };
    const selected = { routePolyline: 'scooter-route' };

    expect(drawSelectedQuoteRoute(selected, map)).toBe(true);
    expect(map.drawRoute).toHaveBeenCalledWith('scooter-route', undefined);
  });

  it('passes map padding through when the screen has an overlay', () => {
    const map = { drawRoute: jest.fn() };
    const padding = { top: 80, bottom: 320, left: 48, right: 48 };

    drawSelectedQuoteRoute({ routePolyline: 'delivery-route' }, map, padding);

    expect(map.drawRoute).toHaveBeenCalledWith('delivery-route', padding);
  });

  it.each([undefined, null, '', '   ', []])('clears the previous route when selected geometry is absent or empty (%p)', (routePolyline) => {
    const map = { drawRoute: jest.fn() };

    expect(drawSelectedQuoteRoute({ routePolyline }, map)).toBe(false);
    expect(map.drawRoute).toHaveBeenCalledWith(null, undefined);
  });
});

describe('isQuoteExpired', () => {
    it('treats missing or elapsed expiry as expired and future expiry as valid', () => {
        expect(isQuoteExpired({}, 1000)).toBe(true);
        expect(isQuoteExpired({ expiresAt: new Date(999).toISOString() }, 1000)).toBe(true);
        expect(isQuoteExpired({ expiresAt: new Date(1001).toISOString() }, 1000)).toBe(false);
    });
});

describe('mergeQuotesWithServices', () => {
  const quote = {
    id: 'quote-1',
    serviceConfigId: 7,
    serviceName: 'Moto Expressa',
    category: 'ride',
    distanceMeters: 12994,
    durationSeconds: 1200,
    estimatedFare: '2627.60',
    expiresAt: '2030-01-01T00:00:00.000Z',
    routePolyline: 'encoded-route',
  };

  it('shows server quotes even if the service list has not finished loading', () => {
    expect(mergeQuotesWithServices([], [quote])).toEqual([expect.objectContaining({
      id: 7,
      name: 'Moto Expressa',
      quoteId: 'quote-1',
      estimatedPrice: 2627.6,
      estimatedTime: 20,
      distanceMeters: 12994,
      routePolyline: 'encoded-route',
    })]);
  });

  it('adds service details when available and ignores invalid or wrong-category quotes', () => {
    const services = [{ id: 7, name: 'Moto Expressa', category: 'ride', vehicle_category: 'moto' }];
    expect(mergeQuotesWithServices(services, [quote, { ...quote, id: 'delivery-1', category: 'delivery' }, { ...quote, id: 'bad-price', estimatedFare: 'NaN' }]))
      .toEqual([expect.objectContaining({ vehicle_category: 'moto', quoteId: 'quote-1' })]);
  });
});
