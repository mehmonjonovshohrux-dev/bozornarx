import { Body, Controller, Get, Module, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { AuditModule } from '../audit/audit.service';
import { AuthModule } from '../auth/auth.module';
import { AuthUser } from '../auth/guards';
import { CatalogModule } from '../catalog/catalog.module';
import { ZodPipe } from '../common/http';
import { Me, PageQuery, Secured, idParam } from '../common/util';
import { AdminService } from './admin.service';
import {
  SettingKey, auditQuery, complaintListQuery, complaintUpdateSchema, marketSchema, planSchema, regionSchema, reviewDecisionSchema, reviewQueueQuery,
  roleChangeSchema, settingKeySchema, subscriptionSchema, userListQuery, userStatusSchema,
} from './admin.schemas';

const id = new ZodPipe(idParam);
type Id = { id: string };
const templateSchema = z.object({
  type: z.literal('SALE'), name: z.string().trim().min(3).max(100),
  clauses: z.array(z.object({ title: z.string().trim().min(2).max(120), text: z.string().trim().min(5).max(3000) })).min(1).max(40),
});

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users') @Secured('users.manage') users(@Query(new ZodPipe(userListQuery)) q: PageQuery & { q?: string; role?: string; status?: string }) { return this.admin.users(q); }
  @Get('users/:id') @Secured('users.manage') user(@Param(id) p: Id) { return this.admin.userDetail(p.id); }
  @Post('users/:id/status') @Secured('users.manage') status(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(userStatusSchema)) b: z.infer<typeof userStatusSchema>) { return this.admin.setStatus(u, p.id, b.status, b.reason); }
  @Post('users/:id/roles') @Secured('users.manage') role(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(roleChangeSchema)) b: z.infer<typeof roleChangeSchema>) { return this.admin.changeRole(u, p.id, b); }
  @Post('users/:id/revoke-sessions') @Secured('users.manage') revoke(@Me() u: AuthUser, @Param(id) p: Id) { return this.admin.revokeSessions(u, p.id); }

  @Get('complaints') @Secured('complaints.review') complaints(@Query(new ZodPipe(complaintListQuery)) q: PageQuery & { status?: string; targetType?: string }) { return this.admin.complaints(q); }
  @Post('complaints/:id') @Secured('complaints.review') updComplaint(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(complaintUpdateSchema)) b: z.infer<typeof complaintUpdateSchema>) { return this.admin.updateComplaint(u, p.id, b); }
  @Get('reviews') @Secured('reviews.moderate') reviews(@Query(new ZodPipe(reviewQueueQuery)) q: PageQuery & { status: 'PENDING' | 'APPROVED' | 'REJECTED' }) { return this.admin.reviewQueue(q, q.status); }
  @Post('reviews/:id') @Secured('reviews.moderate') decideReview(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(reviewDecisionSchema)) b: z.infer<typeof reviewDecisionSchema>) { return this.admin.decideReview(u, p.id, b); }

  @Get('plans') @Secured('plans.manage') plans() { return this.admin.plans(true); }
  @Put('plans') @Secured('plans.manage') plan(@Me() u: AuthUser, @Body(new ZodPipe(planSchema)) b: z.infer<typeof planSchema>) { return this.admin.upsertPlan(u, b); }
  @Post('subscriptions') @Secured('plans.manage') grant(@Me() u: AuthUser, @Body(new ZodPipe(subscriptionSchema)) b: z.infer<typeof subscriptionSchema>) { return this.admin.grantSubscription(u, b); }

  @Get('stats') @Secured('stats.view') stats() { return this.admin.stats(); }
  @Get('moderator/stats') @Secured('prices.moderate') modStats(@Me() u: AuthUser) { return this.admin.moderatorStats(u.id); }
  @Get('audit') @Secured('audit.read') audit(@Query(new ZodPipe(auditQuery)) q: PageQuery & { actorId?: string; action?: string; entityType?: string; from?: Date; to?: Date }) { return this.admin.auditLog(q); }
  @Get('audit.csv') @Secured('audit.read')
  async auditCsv(@Query(new ZodPipe(auditQuery)) q: PageQuery & { actorId?: string; action?: string; entityType?: string; from?: Date; to?: Date }, @Res() res: Response) {
    res.set({ 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="audit.csv"', 'cache-control': 'private, no-store' });
    res.send(await this.admin.auditCsv(q));
  }

  @Get('settings') @Secured('system.settings') settings() { return this.admin.settings(); }
  @Put('settings/:key') @Secured('system.settings') put(@Me() u: AuthUser, @Param(new ZodPipe(settingKeySchema)) p: { key: SettingKey }, @Body() b: { value: unknown }) { return this.admin.putSetting(u, p.key, b?.value); }

  @Get('templates') @Secured('system.settings') templates() { return this.admin.templates(); }
  @Post('templates') @Secured('system.settings') template(@Me() u: AuthUser, @Body(new ZodPipe(templateSchema)) b: z.infer<typeof templateSchema>) { return this.admin.newTemplateVersion(u, b); }

  @Post('regions') @Secured('catalog.manage') region(@Me() u: AuthUser, @Body(new ZodPipe(regionSchema)) b: z.infer<typeof regionSchema>) { return this.admin.createRegion(u, b); }
  @Post('markets') @Secured('catalog.manage') market(@Me() u: AuthUser, @Body(new ZodPipe(marketSchema)) b: z.infer<typeof marketSchema>) { return this.admin.createMarket(u, b); }
  @Patch('markets/:id') @Secured('catalog.manage') updMarket(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(marketSchema.partial())) b: Partial<z.infer<typeof marketSchema>>) { return this.admin.updateMarket(u, p.id, b); }
}

/** A seller reads their own plan limits here (not admin-only). */
@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly admin: AdminService) {}
  @Get() list() { return this.admin.plans(false); }
  @Get('store/:id') @Secured('stores.manage') async store(@Param(id) p: Id) { return this.admin.storePlan(p.id); }
}

@Module({ imports: [AuthModule, AuditModule, CatalogModule], controllers: [AdminController, PlansController], providers: [AdminService], exports: [AdminService] })
export class AdminModule {}
