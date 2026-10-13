export const getOfferSecondsRemaining = (expiresAt, now = Date.now()) => {
  const expiry = Date.parse(expiresAt || '');
  if (!Number.isFinite(expiry)) return null;
  return Math.max(0, Math.ceil((expiry - now) / 1000));
};
