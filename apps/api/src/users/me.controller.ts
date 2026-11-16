import { Controller, Get, Module, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthModule } from '../auth/auth.module';
import { AuthedRequest, JwtAuthGuard } from '../auth/guards';
import { AppError } from '../common/app-error';
import { ROLE_PERMISSIONS, Role } from '../domain/permissions';
import { PrismaService } from '../prisma/prisma.service';

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
      select: { id: true, email: true, emailVerifiedAt: true, phone: true, phoneVerifiedAt: true, createdAt: true, profile: { select: { fullName: true, locale: true } } },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Foydalanuvchi topilmadi.');
    const permissions = [...new Set(req.user.roles.flatMap((r: Role) => ROLE_PERMISSIONS[r]))].sort();
    return { ...user, roles: req.user.roles, permissions };
  }
}

@Module({ imports: [AuthModule], controllers: [MeController] })
export class UsersModule {}
