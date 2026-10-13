export function drawSelectedQuoteRoute(service, map) {
    if (!service?.routePolyline || typeof map?.drawRoute !== 'function') return false;
    map.drawRoute(service.routePolyline);
    return true;
}

export function isQuoteExpired(service, now = Date.now()) {
    const expiresAt = Date.parse(service?.expiresAt || '');
    return !Number.isFinite(expiresAt) || expiresAt <= now;
}
