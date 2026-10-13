import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

describe('PaymentsService cash settlement', () => {
  const trip = { id: 'trip-a', driver_id: 'driver-a', status: 'completed' };
  const pending = { id: 'payment-a', trip_id: 'trip-a', method: 'cash', amount: '950.00', status: 'pending' };

  it('allows only the assigned driver to confirm cash collection', async () => {
    const tx = {
      trips: { findUnique: jest.fn().mockResolvedValue({ ...trip, driver_id: 'driver-b' }) },
      trip_payments: { findUnique: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new PaymentsService(prisma as never);

    await expect(service.confirmCashPayment('trip-a', 'driver-a', '950.00')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.trip_payments.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a collected amount that differs from the server amount', async () => {
    const tx = {
      trips: { findUnique: jest.fn().mockResolvedValue(trip) },
      trip_payments: {
        findUnique: jest.fn().mockResolvedValue(pending),
        updateMany: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new PaymentsService(prisma as never);

    await expect(service.confirmCashPayment('trip-a', 'driver-a', '1.00')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.trip_payments.updateMany).not.toHaveBeenCalled();
  });

  it('records cash confirmation once and returns the existing result on retry', async () => {
    const confirmed = { ...pending, status: 'confirmed', confirmed_by: 'driver-a' };
    const tx = {
      trips: { findUnique: jest.fn().mockResolvedValue(trip) },
      trip_payments: {
        findUnique: jest.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(confirmed),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      audit_logs: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(callback => callback(tx)) };
    const service = new PaymentsService(prisma as never);

    await expect(service.confirmCashPayment('trip-a', 'driver-a', '950.00')).resolves.toEqual(confirmed);
    expect(tx.trip_payments.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'payment-a', status: 'pending', method: 'cash' },
      data: expect.objectContaining({ status: 'confirmed', confirmed_by: 'driver-a', confirmed_at: expect.any(Date) }),
    }));
    expect(tx.audit_logs.create).toHaveBeenCalledWith({
      data: { admin_id: 'driver-a', action: 'cash_payment_confirmed', target: 'trip_payment', target_id: 'payment-a', details: { tripId: 'trip-a', amount: '950.00', method: 'cash' } },
    });
  });

  it('treats a repeated confirmation as idempotent', async () => {
    const confirmed = { ...pending, status: 'confirmed', confirmed_by: 'driver-a' };
    const tx = {
      trips: { findUnique: jest.fn().mockResolvedValue(trip) },
      trip_payments: { findUnique: jest.fn().mockResolvedValue(confirmed), updateMany: jest.fn() },
    };
    const service = new PaymentsService({ $transaction: jest.fn(callback => callback(tx)) } as never);
    await expect(service.confirmCashPayment('trip-a', 'driver-a', '950.00')).resolves.toEqual(confirmed);
    expect(tx.trip_payments.updateMany).not.toHaveBeenCalled();
  });

  it('returns the concurrent confirmation without adding a second audit record', async () => {
    const confirmed = { ...pending, status: 'confirmed', confirmed_by: 'driver-a' };
    const tx = {
      trips: { findUnique: jest.fn().mockResolvedValue(trip) },
      trip_payments: {
        findUnique: jest.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(confirmed),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      audit_logs: { create: jest.fn() },
    };
    const service = new PaymentsService({ $transaction: jest.fn(callback => callback(tx)) } as never);
    await expect(service.confirmCashPayment('trip-a', 'driver-a', '950.00')).resolves.toEqual(confirmed);
    expect(tx.audit_logs.create).not.toHaveBeenCalled();
  });
});
