import { getTripFare } from './tripFare';

describe('getTripFare', () => {
    it('prefers the server final fare over stale quote fields', () => {
        expect(getTripFare({ final_fare: '1250.50', current_fare: '1200.00', price: 1100 })).toBe(1250.5);
    });

    it('uses the next valid server quote field when final fare is absent', () => {
        expect(getTripFare({ final_fare: null, current_fare: '850.00', price: 800 })).toBe(850);
    });

    it('returns null instead of inventing a zero amount for missing or invalid fare', () => {
        expect(getTripFare({ final_fare: 'invalid', current_fare: null, price: undefined })).toBeNull();
        expect(getTripFare({ final_fare: '0', price: 0 })).toBeNull();
    });

    it('does not fall back to a stale quote when a server final fare is malformed', () => {
        expect(getTripFare({ final_fare: 'broken', current_fare: '850.00', price: '800.00' })).toBeNull();
    });

    it('does not treat a zero final fare as missing and use an old quote', () => {
        expect(getTripFare({ final_fare: 0, current_fare: '850.00', price: '800.00' })).toBeNull();
    });

    it('does not fall back to a cached price when the current server fare is malformed', () => {
        expect(getTripFare({ final_fare: null, current_fare: 'NaN', price: '800.00' })).toBeNull();
    });

    it('requires final_fare for payment confirmation even if an estimate is present', () => {
        expect(getTripFare({ final_fare: null, current_fare: '850.00', price: '800.00' }, { requireFinalFare: true })).toBeNull();
        expect(getTripFare({ final_fare: '1250.50', current_fare: '850.00' }, { requireFinalFare: true })).toBe(1250.5);
    });

    it('rejects non-numeric types instead of coercing them into money values', () => {
        expect(getTripFare({ final_fare: true, current_fare: '850.00' })).toBeNull();
    });

    it('rejects non-decimal numeric syntax in fare strings', () => {
        expect(getTripFare({ final_fare: '0x10' })).toBeNull();
    });
});
