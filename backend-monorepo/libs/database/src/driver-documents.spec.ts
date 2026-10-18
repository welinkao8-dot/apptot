import {
  decodeDriverDocument,
  getCurrentDriverDocumentImages,
  getDriverDocumentPresence,
  purgeExpiredDriverDocuments,
  replaceDriverDocuments,
  scheduleDriverDocumentRetention,
} from './driver-documents';

const jpeg = 'data:image/jpeg;base64,/9j/';
const submitted = { bi_frente: jpeg, bi_verso: jpeg, carta: jpeg };

describe('private driver document storage', () => {
  it('decodes only the bounded image data URI into private binary metadata', () => {
    expect(decodeDriverDocument(jpeg)).toEqual({
      content: Buffer.from([0xff, 0xd8, 0xff]),
      mimeType: 'image/jpeg',
      sizeBytes: 3,
    });
    expect(() => decodeDriverDocument('data:image/svg+xml;base64,PHN2Zz4=' )).toThrow();
    expect(() => decodeDriverDocument('not-an-image')).toThrow();
  });

  it('atomically supersedes the previous files and writes the new three images as bytes', async () => {
    const tx = {
      driver_documents: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const now = new Date('2026-10-17T12:00:00.000Z');

    await replaceDriverDocuments(tx as never, 'driver-a', submitted, now, 30);

    expect(tx.driver_documents.updateMany).toHaveBeenCalledTimes(3);
    expect(tx.driver_documents.updateMany).toHaveBeenCalledWith({
      where: { driver_id: 'driver-a', document_type: 'bi_frente', superseded_at: null, deleted_at: null },
      data: { superseded_at: now, retention_until: new Date('2026-11-16T12:00:00.000Z') },
    });
    expect(tx.driver_documents.create).toHaveBeenCalledTimes(3);
    expect(tx.driver_documents.create).toHaveBeenCalledWith({ data: {
      driver_id: 'driver-a', document_type: 'bi_frente', content: Buffer.from([0xff, 0xd8, 0xff]),
      mime_type: 'image/jpeg', size_bytes: 3, uploaded_at: now,
    } });
  });

  it('keeps a current document without an expiry when no retention period was approved/configured', async () => {
    const tx = { driver_documents: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn() } };
    const now = new Date('2026-10-17T12:00:00.000Z');

    await replaceDriverDocuments(tx as never, 'driver-a', submitted, now, null);

    expect(tx.driver_documents.create.mock.calls.every(([call]) => !('retention_until' in call.data))).toBe(true);
  });

  it('returns document data only for the private review route and reports presence without bytes', async () => {
    const prisma = {
      drivers: { findUnique: jest.fn().mockResolvedValue({ id: 'driver-a' }) },
      driver_documents: { findMany: jest.fn().mockResolvedValue([
        { document_type: 'bi_frente', content: Buffer.from([0xff, 0xd8, 0xff]), mime_type: 'image/jpeg' },
      ]) },
    };

    await expect(getCurrentDriverDocumentImages(prisma as never, 'driver-a')).resolves.toEqual({
      id: 'driver-a', doc_bi_frente: jpeg, doc_bi_verso: null, doc_carta_conducao: null,
    });
    await expect(getDriverDocumentPresence(prisma as never, 'driver-a')).resolves.toEqual({
      id: 'driver-a', status: undefined, documents: { bi_frente: true, bi_verso: false, carta: false },
    });
    expect(prisma.driver_documents.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ driver_id: 'driver-a', superseded_at: null, deleted_at: null }),
    }));
  });

  it('schedules retention only for ended/rejected accounts and clears it on reactivation', async () => {
    const tx = { driver_documents: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) } };
    const now = new Date('2026-10-17T12:00:00.000Z');

    await scheduleDriverDocumentRetention(tx as never, 'driver-a', 'rejected', 90, now);
    expect(tx.driver_documents.updateMany).toHaveBeenNthCalledWith(1, {
      where: { driver_id: 'driver-a', deleted_at: null },
      data: { retention_until: new Date('2027-01-15T12:00:00.000Z') },
    });
    await scheduleDriverDocumentRetention(tx as never, 'driver-a', 'active', 90, now);
    expect(tx.driver_documents.updateMany).toHaveBeenNthCalledWith(2, {
      where: { driver_id: 'driver-a', deleted_at: null }, data: { retention_until: null },
    });
    await scheduleDriverDocumentRetention(tx as never, 'driver-a', 'suspended', 90, now);
    expect(tx.driver_documents.updateMany).toHaveBeenCalledTimes(2);
  });

  it('purges only expired, non-held bytes while retaining an audit tombstone', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = { driver_documents: { updateMany } };
    const now = new Date('2026-10-17T12:00:00.000Z');

    await expect(purgeExpiredDriverDocuments(prisma as never, now)).resolves.toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: { retention_until: { lte: now }, deleted_at: null, legal_hold: false, content: { not: null } },
      data: { content: null, deleted_at: now, deletion_reason: 'retention' },
    });
  });
});
