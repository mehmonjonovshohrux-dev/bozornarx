import { applyDecorators, createParamDecorator, ExecutionContext, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthUser, AuthedRequest, JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../auth/guards';
import { Permission, Role } from '../domain/permissions';

/** Login required + all listed permissions. Ownership rules are enforced again in the services. */
export const Secured = (...perms: Permission[]) =>
  applyDecorators(UseGuards(JwtAuthGuard, PermissionsGuard), RequirePermissions(...perms), ApiBearerAuth());

export const Me = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<AuthedRequest>().user);

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}
export const Client = createParamDecorator((_data: unknown, ctx: ExecutionContext): ClientInfo => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip ?? null, userAgent: (req.headers['user-agent'] as string | undefined) ?? null };
});

export const isStaff = (roles: readonly Role[]): boolean => roles.includes('MODERATOR') || roles.includes('SUPER_ADMIN');
export const isAdmin = (roles: readonly Role[]): boolean => roles.includes('SUPER_ADMIN');

export const uuidSchema = z.string().uuid('Identifikator noto‘g‘ri');
export const idParam = z.object({ id: uuidSchema });

/** Query values arrive as strings; empty string means "not set". */
export const optStr = z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined));
export const optNum = z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().finite().optional());
export const optBool = z.preprocess((v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined), z.boolean().optional());

export const pageSchema = z.object({
  page: z.preprocess((v) => (v === undefined || v === '' ? 1 : Number(v)), z.number().int().min(1).max(10_000)),
  pageSize: z.preprocess((v) => (v === undefined || v === '' ? 20 : Number(v)), z.number().int().min(1).max(100)),
});
export type PageQuery = z.infer<typeof pageSchema>;

export function paged<T>(items: T[], total: number, q: PageQuery) {
  return { items, total, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export const num = (d: { toString(): string } | number | null | undefined): number => (d === null || d === undefined ? 0 : Number(d.toString()));
