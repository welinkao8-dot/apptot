export function normalizeDeliveryInfo(input) {
  const recipientName = typeof input?.recipientName === 'string' ? input.recipientName.trim() : '';
  const recipientPhone = typeof input?.recipientPhone === 'string'
    ? input.recipientPhone.replace(/[\s()-]/g, '')
    : '';
  const packageDescription = typeof input?.packageDescription === 'string' ? input.packageDescription.trim() : '';

  const value = { recipientName, recipientPhone, packageDescription };
  if (!recipientName || recipientName.length > 150 || !packageDescription || packageDescription.length > 500) {
    return { valid: false, reason: 'required', value };
  }
  if (!/^(?:\+244)?9\d{8}$/.test(recipientPhone)) return { valid: false, reason: 'phone', value };
  return { valid: true, value };
}
