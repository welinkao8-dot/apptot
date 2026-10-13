import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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
