import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const DRIVER_DOCUMENT_TYPES = ['bi_frente', 'bi_verso', 'carta'] as const;
export type DriverDocumentType = (typeof DRIVER_DOCUMENT_TYPES)[number];
export type DriverDocumentPayload = Record<DriverDocumentType, string>;

const documentFields: Record<DriverDocumentType, 'doc_bi_frente' | 'doc_bi_verso' | 'doc_carta_conducao'> = {
  bi_frente: 'doc_bi_frente',
  bi_verso: 'doc_bi_verso',
  carta: 'doc_carta_conducao',
};

export function decodeDriverDocument(dataUri: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUri);
  if (!match || match[2].length % 4 !== 0) throw new Error('Documento inválido.');
  const mimeType = `image/${match[1].toLowerCase()}`;
  const content = Buffer.from(match[2], 'base64');
  const hasSignature = mimeType === 'image/jpeg'
    ? content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
    : mimeType === 'image/png'
      ? content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : content.length >= 12 && content.toString('ascii', 0, 4) === 'RIFF' && content.toString('ascii', 8, 12) === 'WEBP';
  if (!hasSignature || content.length > 8 * 1024 * 1024) throw new Error('Documento inválido.');
  return { content, mimeType, sizeBytes: content.length };
}

export function readDriverDocumentRetentionDays(value = process.env.DRIVER_DOCUMENT_RETENTION_DAYS): number | null {
  if (value === undefined || value.trim() === '') return null;
  if (!/^\d+$/.test(value)) throw new Error('DRIVER_DOCUMENT_RETENTION_DAYS must be a positive whole number.');
  const days = Number(value);
  if (!Number.isSafeInteger(days) || days < 1 || days > 36_500) {
    throw new Error('DRIVER_DOCUMENT_RETENTION_DAYS must be between 1 and 36500.');
  }
  return days;
}

function retentionDate(now: Date, days: number | null) {
  if (days === null) return null;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function replaceDriverDocuments(
  tx: Prisma.TransactionClient,
  driverId: string,
  submitted: DriverDocumentPayload,
  now = new Date(),
  retentionDays = readDriverDocumentRetentionDays(),
) {
  const retentionUntil = retentionDate(now, retentionDays);
  for (const documentType of DRIVER_DOCUMENT_TYPES) {
    const { content, mimeType, sizeBytes } = decodeDriverDocument(submitted[documentType]);
    await tx.driver_documents.updateMany({
      where: { driver_id: driverId, document_type: documentType, superseded_at: null, deleted_at: null },
      data: { superseded_at: now, retention_until: retentionUntil },
    });
    await tx.driver_documents.create({
      data: {
        driver_id: driverId,
        document_type: documentType,
        content,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        uploaded_at: now,
      },
    });
  }
}

export async function getCurrentDriverDocumentImages(prisma: Prisma.TransactionClient | any, driverId: string) {
  const driver = await prisma.drivers.findUnique({ where: { id: driverId }, select: { id: true } });
  if (!driver) throw new NotFoundException('Motorista não encontrado.');
  const records = await prisma.driver_documents.findMany({
    where: { driver_id: driverId, superseded_at: null, deleted_at: null, content: { not: null } },
    select: { document_type: true, content: true, mime_type: true },
  });
  const images: Record<string, string | null> = {
    doc_bi_frente: null,
    doc_bi_verso: null,
    doc_carta_conducao: null,
  };
  for (const record of records) {
    const field = documentFields[record.document_type as DriverDocumentType];
    if (field && record.content) {
      images[field] = `data:${record.mime_type};base64,${Buffer.from(record.content).toString('base64')}`;
    }
  }
  return { id: driver.id, ...images };
}

export async function getDriverDocumentPresence(prisma: Prisma.TransactionClient | any, driverId: string) {
  const driver = await prisma.drivers.findUnique({
    where: { id: driverId },
    select: { id: true, status: true },
  });
  if (!driver) throw new NotFoundException('Motorista não encontrado.');
  const records = await prisma.driver_documents.findMany({
    where: { driver_id: driverId, superseded_at: null, deleted_at: null, content: { not: null } },
    select: { document_type: true },
  });
  const present = new Set(records.map((record: { document_type: string }) => record.document_type));
  return {
    id: driver.id,
    status: driver.status,
    documents: {
      bi_frente: present.has('bi_frente'),
      bi_verso: present.has('bi_verso'),
      carta: present.has('carta'),
    },
  };
}

export async function scheduleDriverDocumentRetention(
  tx: Prisma.TransactionClient,
  driverId: string,
  status: string,
  retentionDays = readDriverDocumentRetentionDays(),
  now = new Date(),
) {
  if (status === 'rejected') {
    await tx.driver_documents.updateMany({
      where: { driver_id: driverId, deleted_at: null },
      data: { retention_until: retentionDate(now, retentionDays) },
    });
  } else if (status === 'active') {
    await tx.driver_documents.updateMany({
      where: { driver_id: driverId, deleted_at: null },
      data: { retention_until: null },
    });
  }
}

export async function purgeExpiredDriverDocuments(prisma: Prisma.TransactionClient | any, now = new Date()) {
  const result = await prisma.driver_documents.updateMany({
    where: { retention_until: { lte: now }, deleted_at: null, legal_hold: false, content: { not: null } },
    data: { content: null, deleted_at: now, deletion_reason: 'retention' },
  });
  return result.count;
}
