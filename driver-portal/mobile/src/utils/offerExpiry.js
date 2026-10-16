export const getOfferSecondsRemaining = (expiresAt, now = Date.now()) => {
  const expiry = Date.parse(expiresAt || '');
  if (!Number.isFinite(expiry)) return null;
  return Math.max(0, Math.ceil((expiry - now) / 1000));
};

export const isOfferExpired = (expiresAt, now = Date.now()) => {
  const expiry = Date.parse(expiresAt || '');
  return Number.isFinite(expiry) && expiry <= now;
};
