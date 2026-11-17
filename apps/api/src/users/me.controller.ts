import { Body, Controller, Delete, Get, Module, Patch, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodPipe } from '../common/http';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthModule } from '../auth/auth.module';
import { AuthedRequest, JwtAuthGuard } from '../auth/guards';
import { AppError } from '../common/app-error';
import { ROLE_PERMISSIONS, Role } from '../domain/permissions';
import { PrismaService } from '../prisma/prisma.service';

const profileSchema = z.object({ fullName: z.string().trim().min(2, 'Ism kamida 2 ta belgi').max(100) });

@ApiTags('me')
@Controller('me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@Req() req: AuthedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, emailVerifiedAt: true, phone: true, phoneVerifiedAt: true, createdAt: true, profile: { select: { fullName: true, locale: true, avatarKey: true } } },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi.');
    const permissions = [...new Set(req.user.roles.flatMap((r: Role) => ROLE_PERMISSIONS[r]))].sort();
    const { profile, ...rest } = user;
    return { ...rest, profile: profile ? { fullName: profile.fullName, locale: profile.locale, avatarUrl: profile.avatarKey ? `/api/files/${profile.avatarKey}/public` : null } : null, roles: req.user.roles, permissions };
  }

  /** Attach an already uploaded AVATAR file (public image owned by this user) as the profile picture. */
  @Put('avatar')
  async setAvatar(@Req() req: AuthedRequest, @Body(new ZodPipe(z.object({ fileId: z.string().uuid() }))) b: { fileId: string }) {
    const f = await this.prisma.fileObject.findUnique({ where: { id: b.fileId }, select: { ownerId: true, kind: true, isPublic: true } });
    if (!f || f.ownerId !== req.user.id || f.kind !== 'AVATAR' || !f.isPublic) throw new AppError(400, 'INVALID_FILE', 'Rasm topilmadi yoki yaroqsiz.');
    await this.prisma.userProfile.update({ where: { userId: req.user.id }, data: { avatarKey: b.fileId } });
    return { avatarUrl: `/api/files/${b.fileId}/public` };
  }

  @Delete('avatar')
  async removeAvatar(@Req() req: AuthedRequest) {
    await this.prisma.userProfile.update({ where: { userId: req.user.id }, data: { avatarKey: null } });
    return { avatarUrl: null };
  }

  /** The user edits only their own display name here (email/phone changes need verification and are not offered). */
  @Patch()
  async update(@Req() req: AuthedRequest, @Body(new ZodPipe(profileSchema)) b: z.infer<typeof profileSchema>) {
    await this.prisma.userProfile.update({ where: { userId: req.user.id }, data: { fullName: b.fullName } });
    return { fullName: b.fullName };
  }
}

@Module({ imports: [AuthModule], controllers: [MeController] })
export class UsersModule {}
