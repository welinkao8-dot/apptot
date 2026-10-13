export function getDocumentReviewStatus(driverStatus, hasDocument) {
    if (!hasDocument) return 'missing';
    return driverStatus === 'active' ? 'approved' : 'pending';
}
