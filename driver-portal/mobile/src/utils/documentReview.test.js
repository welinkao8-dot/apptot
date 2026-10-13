import { getDocumentReviewStatus } from './documentReview';

describe('getDocumentReviewStatus', () => {
    it('shows a persisted submitted document as approved only for an active driver', () => {
        expect(getDocumentReviewStatus('active', true)).toBe('approved');
        expect(getDocumentReviewStatus('pending_docs', true)).toBe('pending');
        expect(getDocumentReviewStatus('suspended', true)).toBe('pending');
    });

    it('shows documents without a persisted file as missing', () => {
        expect(getDocumentReviewStatus('active', false)).toBe('missing');
    });
});
