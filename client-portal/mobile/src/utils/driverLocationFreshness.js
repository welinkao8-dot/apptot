export const getDriverLocationFreshness = (updatedAt, now = Date.now(), staleAfterMs = 30_000) => {
  if (!Number.isFinite(updatedAt)) return 'waiting';
  const age = now - updatedAt;
  if (age < 0 || age > staleAfterMs) return 'stale';
  return 'fresh';
};
