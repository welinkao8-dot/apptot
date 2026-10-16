const DOCUMENT_FIELDS = ['bi_frente', 'bi_verso', 'carta']
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export function createDriverDocumentDataUri(asset) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(asset?.type)) return null
  if (typeof asset.base64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(asset.base64)) return null
  const paddingBytes = asset.base64.endsWith('==') ? 2 : asset.base64.endsWith('=') ? 1 : 0
  const sizeBytes = typeof asset.fileSize === 'number'
    ? asset.fileSize
    : Math.floor(asset.base64.length * 3 / 4) - paddingBytes
  if (sizeBytes <= 0 || sizeBytes > MAX_IMAGE_BYTES) return null
  return `data:${asset.type};base64,${asset.base64}`
}

export function areDriverDocumentsReady(documents) {
  return DOCUMENT_FIELDS.every(field =>
    typeof documents?.[field] === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(documents[field]),
  )
}

export function createDriverDocumentPayload(documents) {
  if (!areDriverDocumentsReady(documents)) return null
  return Object.fromEntries(DOCUMENT_FIELDS.map(field => [field, documents[field]]))
}
