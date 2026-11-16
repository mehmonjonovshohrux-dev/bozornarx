import { Injectable, Module } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppError } from '../common/app-error';
import { isStaff } from '../common/util';
import { Role } from '../domain/permissions';
import { PrismaService } from '../prisma/prisma.service';

export type FileKind = 'PRODUCT_IMAGE' | 'CHAT' | 'EVIDENCE' | 'STORE_DOC' | 'CONTRACT_PDF' | 'DELIVERY_ACT';

const IMAGE_MAX = 5 * 1024 * 1024;
const DOC_MAX = 8 * 1024 * 1024;

/** Detects the real type from the first bytes. The client-declared mime type is never trusted. */
export function sniffMime(b: Buffer): string | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (b.length >= 5 && b.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

const ALLOWED: Record<FileKind, readonly string[]> = {
  PRODUCT_IMAGE: ['image/png', 'image/jpeg', 'image/webp'],
  CHAT: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  EVIDENCE: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  STORE_DOC: ['image/png', 'image/jpeg', 'application/pdf'],
  CONTRACT_PDF: ['application/pdf'],
  DELIVERY_ACT: ['image/png', 'image/jpeg', 'application/pdf'],
};

/** The only code that touches the file table. Replace the body with S3 calls later; callers do not change. */
@Injectable()
export class StorageService {
  constructor(private readonly prisma: PrismaService) {}

  async put(args: { ownerId: string; kind: FileKind; data: Buffer; isPublic?: boolean }) {
    const mime = sniffMime(args.data);
    if (!mime || !ALLOWED[args.kind].includes(mime)) throw new AppError(400, 'FILE_TYPE_NOT_ALLOWED', 'Fayl turi ruxsat etilmagan.');
    const max = mime === 'application/pdf' ? DOC_MAX : IMAGE_MAX;
    if (args.data.length === 0 || args.data.length > max) throw new AppError(413, 'FILE_TOO_LARGE', `Fayl hajmi ${Math.round(max / 1024 / 1024)} MB dan oshmasligi kerak.`);
    const f = await this.prisma.fileObject.create({
      data: { ownerId: args.ownerId, kind: args.kind, mime, size: args.data.length, sha256: createHash('sha256').update(args.data).digest('hex'), isPublic: args.isPublic ?? false, data: args.data },
      select: { id: true, mime: true, size: true, sha256: true, kind: true },
    });
    return f;
  }

  async get(id: string) {
    return this.prisma.fileObject.findUnique({ where: { id } });
  }

  /** Owner, staff, or a participant of the chat the file was sent in. */
  async canRead(file: { id: string; ownerId: string; isPublic: boolean }, userId: string, roles: readonly Role[]): Promise<boolean> {
    if (file.isPublic || file.ownerId === userId || isStaff(roles)) return true;
    const msg = await this.prisma.message.findFirst({
      where: { attachmentKey: file.id, conversation: { OR: [{ buyerId: userId }, { store: { ownerId: userId } }] } },
      select: { id: true },
    });
    if (msg) return true;
    const doc = await this.prisma.contractVersion.findFirst({
      where: { pdfKey: file.id, contract: { OR: [{ buyerId: userId }, { sellerStore: { ownerId: userId } }] } },
      select: { id: true },
    });
    return !!doc;
  }
}

@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
