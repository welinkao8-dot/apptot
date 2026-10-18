const ACTIVE_TRIP_STATUSES = new Set(['requested', 'accepted', 'arrived', 'ongoing']);

function resolveArrayResource(result, previous, resourceName, now, transform = value => value, allowPaginated = false) {
  if (result?.status !== 'fulfilled') {
    return {
      value: previous,
      error: `Falha ao carregar ${resourceName}. Tente novamente.`,
      lastUpdated: null,
    };
  }

  const payload = result.value?.data;
  const items = Array.isArray(payload) ? payload : allowPaginated ? payload?.items : null;
  if (!Array.isArray(items)) {
    return {
      value: previous,
      error: `Resposta inválida ao carregar ${resourceName}.`,
      lastUpdated: null,
    };
  }

  const total = Number.isSafeInteger(payload?.total) && payload.total >= 0 ? payload.total : items.length;
  return { value: transform(items), total, error: null, lastUpdated: now.toISOString() };
}

export function resolveLiveOpsResults(results, previous, now = new Date()) {
  const drivers = resolveArrayResource(results?.[0], previous.drivers, 'motoristas', now);
  const trips = resolveArrayResource(
    results?.[1],
    previous.activeTrips,
    'corridas',
    now,
    items => items.filter(trip => ACTIVE_TRIP_STATUSES.has(trip?.status)),
    true,
  );

  return {
    drivers: drivers.value,
    activeTrips: trips.value,
    activeTripsTotal: trips.error ? (previous.activeTripsTotal ?? trips.value.length) : trips.total,
    errors: { drivers: drivers.error, trips: trips.error },
    lastUpdated: {
      drivers: drivers.lastUpdated || previous.lastUpdated.drivers,
      trips: trips.lastUpdated || previous.lastUpdated.trips,
    },
  };
}
