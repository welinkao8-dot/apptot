import { rankDriversByDistance } from './dispatch';

describe('rankDriversByDistance', () => {
  it('filters invalid coordinates and ranks nearest driver first', () => {
    const result = rankDriversByDistance({ lat: -8.84, lng: 13.29 }, [
      { id: 'far', lat: -8.9, lng: 13.5 },
      { id: 'near', lat: -8.841, lng: 13.291 },
      { id: 'invalid', lat: 91, lng: 13 },
    ]);
    expect(result.map(({ id }) => id)).toEqual(['near', 'far']);
  });
});
