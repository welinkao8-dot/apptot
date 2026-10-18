import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService, purgeExpiredDriverDocuments } from '@app/database';

const RETENTION_RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DriverDocumentRetentionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DriverDocumentRetentionScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.run().catch(() => this.logger.error('Driver document retention job failed.'));
    this.timer = setInterval(() => {
      void this.run().catch(() => this.logger.error('Driver document retention job failed.'));
    }, RETENTION_RUN_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    const purged = await this.prisma.$transaction(async (tx) => {
      const locks = await tx.$queryRawUnsafe<Array<{ acquired: boolean }>>(
        'SELECT pg_try_advisory_xact_lock($1, $2) AS acquired', 198203, 1701,
      );
      if (!locks[0]?.acquired) return 0;
      return purgeExpiredDriverDocuments(tx);
    });
    if (purged > 0) this.logger.log(`Purged ${purged} expired driver document file(s).`);
    return purged;
  }
}
