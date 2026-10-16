const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

export function validateDriverDocumentImage(dataUri: string): boolean {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUri);
  if (!match) return false;

  const [, declaredType, encoded] = match;
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) return false;
  if (bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) return false;

  const type = declaredType.toLowerCase();
  if (type === 'jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 12
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP';
}
