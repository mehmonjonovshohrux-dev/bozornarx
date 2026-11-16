import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string; // e.g. AUTH_LOGIN_FAILED
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue; // never put passwords, codes or tokens here
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly log = new Logger('audit');
  constructor(private readonly prisma: PrismaService) {}

  /** Audit failures must not break the user's request, but they are reported. */
  async record(e: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: e.actorId ?? null,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId ?? null,
          before: e.before,
          after: e.after,
          ip: e.ip ?? null,
          userAgent: e.userAgent ? e.userAgent.slice(0, 255) : null,
        },
      });
    } catch {
      this.log.error(`failed to write audit entry action=${e.action}`);
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
