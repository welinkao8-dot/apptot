import { unlink } from 'fs/promises';
import { dirname, resolve } from 'path';

const SERVICE_IMAGE_PATH = /^\/uploads\/services\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/i;

export function getManagedServiceImageAssetId(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  try {
    const image = new URL(imageUrl);
    const api = new URL(process.env.ADMIN_API_URL || 'http://localhost:3000');
    const match = SERVICE_IMAGE_PATH.exec(image.pathname);
    if (image.origin !== api.origin || image.search || image.hash || !match) return null;
    return match[1];
  } catch {
    return null;
  }
}

function managedServiceImagePath(imageUrl: string): string | null {
  let image: URL;
  let api: URL;
  try {
    image = new URL(imageUrl);
    api = new URL(process.env.ADMIN_API_URL || 'http://localhost:3000');
  } catch {
    return null;
  }

  if (image.origin !== api.origin || image.search || image.hash) return null;
  const match = SERVICE_IMAGE_PATH.exec(image.pathname);
  if (!match) return null;

  const directory = resolve(process.cwd(), 'uploads', 'services');
  const filePath = resolve(directory, `${match[1]}${image.pathname.slice(image.pathname.lastIndexOf('.'))}`);
  return dirname(filePath) === directory ? filePath : null;
}

/** Removes only image files uploaded by this API, and only once no config references the URL. */
export async function cleanupServiceImageIfUnreferenced(
  imageUrl: string | null | undefined,
  isReferenced: (url: string) => Promise<boolean>,
): Promise<void> {
  if (!imageUrl) return;
  const filePath = managedServiceImagePath(imageUrl);
  if (!filePath) return;

  try {
    if (await isReferenced(imageUrl)) return;
    await unlink(filePath);
  } catch {
    // File cleanup is best-effort and must not turn a persisted config change into an API failure.
  }
}
