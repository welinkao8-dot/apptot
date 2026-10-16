export function drawSelectedQuoteRoute(service, map, padding) {
    if (typeof map?.drawRoute !== 'function') return false;

    const routePolyline = service?.routePolyline;
    const hasGeometry = typeof routePolyline === 'string'
        ? routePolyline.trim().length > 0
        : Array.isArray(routePolyline)
            ? routePolyline.length > 0
            : Boolean(routePolyline);

    if (!hasGeometry) {
        map.drawRoute(null, padding);
        return false;
    }

    map.drawRoute(routePolyline, padding);
    return true;
}

export function isQuoteExpired(service, now = Date.now()) {
    const expiresAt = Date.parse(service?.expiresAt || '');
    return !Number.isFinite(expiresAt) || expiresAt <= now;
}

export function mergeQuotesWithServices(services = [], quotes = [], category = 'ride') {
    const servicesById = new Map(
        services
            .filter((service) => service?.category === category)
            .map((service) => [Number(service.id), service]),
    );

    return quotes
        .filter((quote) => quote?.category === category && quote?.id && Number.isFinite(Number(quote.serviceConfigId)))
        .map((quote) => {
            const service = servicesById.get(Number(quote.serviceConfigId));
            const distanceMeters = Number(quote.distanceMeters);
            const durationSeconds = Number(quote.durationSeconds);
            const estimatedPrice = Number(quote.estimatedFare);

            if (!Number.isFinite(distanceMeters) || distanceMeters <= 0
                || !Number.isFinite(durationSeconds) || durationSeconds <= 0
                || !Number.isFinite(estimatedPrice) || estimatedPrice <= 0) return null;

            return {
                ...service,
                id: service?.id ?? Number(quote.serviceConfigId),
                name: service?.name || quote.serviceName,
                category: quote.category,
                quoteId: quote.id,
                expiresAt: quote.expiresAt,
                estimatedPrice,
                estimatedTime: Math.ceil(durationSeconds / 60),
                distanceMeters,
                routePolyline: quote.routePolyline,
            };
        })
        .filter(Boolean);
}
