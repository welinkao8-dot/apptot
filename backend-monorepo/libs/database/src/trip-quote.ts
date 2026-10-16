import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const activeClientTripWhere = (clientId: string) => ({
  client_id: clientId,
  OR: [
    { status: { in: ['requested', 'accepted', 'ongoing'] } },
    { status: 'completed', trip_payment: { is: { status: 'pending' } } },
  ],
});

/** Serialize trip creation attempts from different API processes for the same client. */
export async function lockClientProfileForTripCreation(tx: Prisma.TransactionClient, clientId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "profiles" WHERE "id" = ${clientId}::uuid FOR UPDATE`);
}

export async function findActiveClientTripForCreation(tx: Prisma.TransactionClient, clientId: string) {
  return tx.trips.findFirst({ where: activeClientTripWhere(clientId), select: { id: true } });
}

export async function consumeTripQuote(tx: Prisma.TransactionClient, quoteId: string, clientId: string) {
  const now = new Date();
  const claim = await tx.trip_quotes.updateMany({
    where: { id: quoteId, client_id: clientId, consumed_at: null, expires_at: { gt: now } },
    data: { consumed_at: now },
  });
  if (claim.count !== 1) {
    const quote = await tx.trip_quotes.findUnique({ where: { id: quoteId }, select: { client_id: true } });
    if (!quote) throw new NotFoundException('Cotação não encontrada.');
    if (quote.client_id !== clientId) throw new ForbiddenException('Esta cotação pertence a outro cliente.');
    throw new BadRequestException('A cotação expirou ou já foi utilizada.');
  }
  const quote = await tx.trip_quotes.findUnique({ where: { id: quoteId } });
  if (!quote) throw new NotFoundException('Cotação não encontrada.');
  return quote;
}
