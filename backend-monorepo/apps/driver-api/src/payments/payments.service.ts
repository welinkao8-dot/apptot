import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/database';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentForDriver(tripId: string, driverId: string) {
    const trip = await this.prisma.trips.findUnique({
      where: { id: tripId },
      select: { id: true, driver_id: true },
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada.');
    if (trip.driver_id !== driverId) throw new ForbiddenException('Apenas o motorista atribuído pode consultar este pagamento.');
    const payment = await this.prisma.trip_payments.findUnique({ where: { trip_id: tripId } });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    return payment;
  }

  async confirmCashPayment(tripId: string, driverId: string, amount: string | number) {
    return this.prisma.$transaction(async (tx) => {
      const trip = await tx.trips.findUnique({
        where: { id: tripId },
        select: { id: true, driver_id: true, client_id: true, category: true, status: true },
      });
      if (!trip) throw new NotFoundException('Viagem não encontrada.');
      if (trip.driver_id !== driverId) throw new ForbiddenException('Apenas o motorista atribuído pode confirmar a cobrança.');
      if (trip.status !== 'completed') throw new BadRequestException('A viagem ainda não está concluída.');

      const payment = await tx.trip_payments.findUnique({ where: { trip_id: tripId } });
      if (!payment) throw new NotFoundException('Pagamento pendente não encontrado.');
      let reportedAmount: Prisma.Decimal;
      try {
        reportedAmount = new Prisma.Decimal(amount);
      } catch {
        throw new BadRequestException('O valor recebido é inválido.');
      }
      if (!reportedAmount.isFinite() || !reportedAmount.equals(payment.amount)) {
        throw new BadRequestException('O valor recebido não corresponde ao valor da viagem.');
      }

      if (payment.status === 'confirmed') {
        if (payment.confirmed_by === driverId) {
          await this.ensureOperationalReceipt(tx, trip, payment);
          return payment;
        }
        throw new BadRequestException('Este pagamento já foi confirmado por outro ator.');
      }
      if (payment.status !== 'pending' || payment.method !== 'cash') {
        throw new BadRequestException('Este pagamento não pode ser confirmado em dinheiro.');
      }

      const confirmedAt = new Date();
      const update = await tx.trip_payments.updateMany({
        where: { id: payment.id, status: 'pending', method: 'cash' },
        data: { status: 'confirmed', confirmed_by: driverId, confirmed_at: confirmedAt },
      });
      if (update.count !== 1) {
        const current = await tx.trip_payments.findUnique({ where: { trip_id: tripId } });
        if (current?.status === 'confirmed' && current.confirmed_by === driverId) {
          await this.ensureOperationalReceipt(tx, trip, current);
          return current;
        }
        throw new BadRequestException('O pagamento foi atualizado por outra operação.');
      }

      await tx.audit_logs.create({
        data: {
          admin_id: driverId,
          action: 'cash_payment_confirmed',
          target: 'trip_payment',
          target_id: payment.id,
          details: { tripId, amount: payment.amount.toString(), method: 'cash' },
        },
      });
      const confirmed = await tx.trip_payments.findUnique({ where: { trip_id: tripId } });
      if (!confirmed) throw new NotFoundException('Pagamento confirmado não foi encontrado.');
      await this.ensureOperationalReceipt(tx, trip, confirmed);
      return confirmed;
    });
  }

  private async ensureOperationalReceipt(
    tx: Prisma.TransactionClient,
    trip: { id: string; client_id: string | null; category: string | null },
    payment: { amount: Prisma.Decimal },
  ) {
    const existing = await tx.invoices.findFirst({ where: { trip_id: trip.id } });
    if (existing) return existing;

    return tx.invoices.create({
      data: {
        trip_id: trip.id,
        user_id: trip.client_id,
        amount: payment.amount,
        invoice_type: trip.category === 'delivery' ? 'delivery_receipt' : 'ride_receipt',
      },
    });
  }
}
