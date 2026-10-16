const ACTIVE_TRIP_STATUSES = new Set(['requested', 'accepted', 'arrived', 'ongoing']);

function resolveArrayResource(result, previous, resourceName, now, transform = value => value) {
  if (result?.status !== 'fulfilled') {
    return {
      value: previous,
      error: `Falha ao carregar ${resourceName}. Tente novamente.`,
      lastUpdated: null,
    };
  }

  if (!Array.isArray(result.value?.data)) {
    return {
      value: previous,
      error: `Resposta inválida ao carregar ${resourceName}.`,
      lastUpdated: null,
    };
  }

  return { value: transform(result.value.data), error: null, lastUpdated: now.toISOString() };
}

export function resolveLiveOpsResults(results, previous, now = new Date()) {
  const drivers = resolveArrayResource(results?.[0], previous.drivers, 'motoristas', now);
  const trips = resolveArrayResource(
    results?.[1],
    previous.activeTrips,
    'corridas',
    now,
    items => items.filter(trip => ACTIVE_TRIP_STATUSES.has(trip?.status)),
  );

  return {
    drivers: drivers.value,
    activeTrips: trips.value,
    errors: { drivers: drivers.error, trips: trips.error },
    lastUpdated: {
      drivers: drivers.lastUpdated || previous.lastUpdated.drivers,
      trips: trips.lastUpdated || previous.lastUpdated.trips,
    },
  };
}
