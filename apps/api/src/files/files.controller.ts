import { Body, Controller, Get, Module, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AuthUser } from '../auth/guards';
import { AppError } from '../common/app-error';
import { ZodPipe } from '../common/http';
import { Me, Secured, idParam } from '../common/util';
import { StorageModule, StorageService } from './files.service';

const uploadSchema = z.object({
  kind: z.enum(['AVATAR', 'PRODUCT_IMAGE', 'CHAT', 'EVIDENCE', 'STORE_DOC', 'DELIVERY_ACT']),
  dataBase64: z.string().min(16).max(12_000_000),
});

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  /** Upload as JSON/base64 (no multipart parser needed). Product images and avatars are public, everything else private. */
  @Post()
  @Secured()
  async upload(@Me() user: AuthUser, @Body(new ZodPipe(uploadSchema)) body: z.infer<typeof uploadSchema>) {
    const data = Buffer.from(body.dataBase64, 'base64');
    return this.storage.put({ ownerId: user.id, kind: body.kind, data, isPublic: body.kind === 'PRODUCT_IMAGE' || body.kind === 'AVATAR' });
  }

  /** Public files only (product images). Long cache: file ids are immutable. */
  @Get(':id/public')
  async publicFile(@Param(new ZodPipe(idParam)) p: { id: string }, @Res() res: Response) {
    const f = await this.storage.get(p.id);
    if (!f || !f.isPublic) throw new AppError(404, 'NOT_FOUND', 'Fayl topilmadi.');
    res.set({ 'content-type': f.mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
    res.send(Buffer.from(f.data));
  }

  @Get(':id')
  @Secured()
  async privateFile(@Me() user: AuthUser, @Param(new ZodPipe(idParam)) p: { id: string }, @Res() res: Response) {
    const f = await this.storage.get(p.id);
    if (!f || !(await this.storage.canRead(f, user.id, user.roles))) throw new AppError(404, 'NOT_FOUND', 'Fayl topilmadi.');
    res.set({ 'content-type': f.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' });
    res.send(Buffer.from(f.data));
  }
}

@Module({ imports: [AuthModule, StorageModule], controllers: [FilesController] })
export class FilesModule {}
