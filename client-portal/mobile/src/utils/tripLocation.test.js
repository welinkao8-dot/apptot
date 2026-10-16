import { formatCoordinateLabel, isValidCoordinate, validateTripLocations } from './tripLocation';

describe('trip location validation', () => {
    it('accepts valid Luanda pickup and destination with labels', () => {
        expect(validateTripLocations(
            { lat: -8.839, lng: 13.289 },
            { lat: -8.95, lng: 13.22 },
            'Maianga',
            'Talatona',
        )).toEqual({ valid: true, reason: null });
    });

    it.each([
        [null, { lat: -8.9, lng: 13.3 }],
        [{ lat: Number.NaN, lng: 13.2 }, { lat: -8.9, lng: 13.3 }],
        [{ lat: 91, lng: 13.2 }, { lat: -8.9, lng: 13.3 }],
        [{ lat: -8.8, lng: 181 }, { lat: -8.9, lng: 13.3 }],
    ])('rejects invalid coordinates %p', (origin, destination) => {
        expect(validateTripLocations(origin, destination, 'A', 'B')).toEqual({ valid: false, reason: 'coordinates' });
    });

    it('rejects the same pickup and destination within one metre', () => {
        expect(validateTripLocations(
            { lat: -8.839, lng: 13.289 },
            { lat: -8.839000001, lng: 13.289000001 },
            'A',
            'B',
        )).toEqual({ valid: false, reason: 'same_location' });
    });

    it('rejects unlabeled locations while allowing coordinate fallback labels from map taps', () => {
        expect(validateTripLocations({ lat: -8.8, lng: 13.2 }, { lat: -8.9, lng: 13.3 }, '', 'B'))
            .toEqual({ valid: false, reason: 'address' });
        expect(isValidCoordinate({ lat: -8.8, lng: 13.2 })).toBe(true);
        expect(formatCoordinateLabel({ lat: -8.8391234, lng: 13.2895678 })).toBe('-8.83912, 13.28957');
        expect(formatCoordinateLabel({ lat: Number.NaN, lng: 13.2 })).toBe('');
    });
});
