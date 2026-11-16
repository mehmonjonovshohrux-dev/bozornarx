import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppError } from '../common/app-error';
import { Permission, ROLES, Role, canAny } from '../domain/permissions';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: string;
  roles: Role[];
  sessionId: string;
}
export type AuthedRequest = Request & { user: AuthUser };

interface AccessPayload {
  sub: string;
  sid: string;
  roles: string[];
}

/**
 * Verifies the access token AND checks in the database that its session is still live and the user is active,
 * so logout, "sign out other devices" and account suspension take effect immediately, not after token expiry.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHORIZED', 'Tizimga kiring.');

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(header.slice(7));
    } catch {
      throw new AppError(401, 'TOKEN_INVALID', 'Seans muddati tugagan. Qayta kiring.');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: { revokedAt: true, expiresAt: true, userId: true, user: { select: { status: true } } },
    });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
      throw new AppError(401, 'SESSION_REVOKED', 'Seans tugagan. Qayta kiring.');
    }

    req.user = { id: payload.sub, sessionId: payload.sid, roles: payload.roles.filter((r): r is Role => (ROLES as readonly string[]).includes(r)) };
    return true;
  }
}

export const PERMISSIONS_KEY = 'required_permissions';
/** Route needs ALL listed permissions. Use together with JwtAuthGuard. */
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const needed = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!needed || needed.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Tizimga kiring.');
    if (!needed.every((p) => canAny(req.user.roles, p))) throw new AppError(403, 'FORBIDDEN', 'Bu amal uchun ruxsatingiz yo‘q.');
    return true;
  }
}
