import { DriverDocumentRetentionScheduler } from './driver-document-retention.scheduler';

describe('DriverDocumentRetentionScheduler', () => {
  it('purges expired documents only after acquiring the PostgreSQL advisory lock', async () => {
    const purge = jest.fn().mockResolvedValue({ count: 2 });
    const tx = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ acquired: true }]), driver_documents: { updateMany: purge } };
    const prisma = { $transaction: jest.fn((callback: (tx: typeof tx) => unknown) => callback(tx)) };
    const scheduler = new DriverDocumentRetentionScheduler(prisma as never);

    await expect(scheduler.run()).resolves.toBe(2);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith('SELECT pg_try_advisory_xact_lock($1, $2) AS acquired', 198203, 1701);
    expect(purge).toHaveBeenCalledTimes(1);
  });

  it('skips a purge when another API replica owns the retention lock', async () => {
    const purge = jest.fn();
    const tx = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ acquired: false }]), driver_documents: { updateMany: purge } };
    const prisma = { $transaction: jest.fn((callback: (tx: typeof tx) => unknown) => callback(tx)) };
    const scheduler = new DriverDocumentRetentionScheduler(prisma as never);

    await expect(scheduler.run()).resolves.toBe(0);
    expect(purge).not.toHaveBeenCalled();
  });
});
