export function isValidCoordinate(point) {
    return Number.isFinite(point?.lat) && Number.isFinite(point?.lng)
        && point.lat >= -90 && point.lat <= 90
        && point.lng >= -180 && point.lng <= 180;
}

export function formatCoordinateLabel(point) {
    if (!isValidCoordinate(point)) return '';
    return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

export function validateTripLocations(origin, destination, originAddress, destinationAddress) {
    if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
        return { valid: false, reason: 'coordinates' };
    }

    if (!originAddress?.trim() || !destinationAddress?.trim()) {
        return { valid: false, reason: 'address' };
    }

    // Reject a route shorter than ~1 metre; coordinates often differ at floating point noise only.
    const latDelta = (destination.lat - origin.lat) * 111_320;
    const lngScale = Math.cos((origin.lat * Math.PI) / 180);
    const lngDelta = (destination.lng - origin.lng) * 111_320 * lngScale;
    if (Math.hypot(latDelta, lngDelta) < 1) {
        return { valid: false, reason: 'same_location' };
    }

    return { valid: true, reason: null };
}
