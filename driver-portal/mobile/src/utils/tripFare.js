function parseFare(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? value : null;
    }
    if (typeof value !== 'string' || value.trim() === '') return null;

    const normalizedValue = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizedValue)) return null;

    const fare = Number(normalizedValue);
    return Number.isFinite(fare) && fare > 0 ? fare : null;
}

export function getTripFare(trip, { requireFinalFare = false } = {}) {
    if (trip?.final_fare !== null && trip?.final_fare !== undefined) {
        return parseFare(trip.final_fare);
    }
    if (requireFinalFare) return null;

    if (trip?.current_fare !== null && trip?.current_fare !== undefined) {
        return parseFare(trip.current_fare);
    }
    return parseFare(trip?.price);
}
