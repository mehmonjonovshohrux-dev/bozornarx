import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthUser } from '../auth/guards';
import { ZodPipe } from '../common/http';
import { Me, PageQuery, Secured, idParam } from '../common/util';
import { ContractStatus } from '../domain/state-machines';
import {
  contractCreateSchema, contractDecisionSchema, contractListQuery, contractTermsUpdateSchema, disputeCreateSchema, disputeListQuery, disputeNoteSchema, disputeResolveSchema,
  orderContractTermsSchema, queueQuery, reasonSchema, signSchema, versionQuery,
} from './contracts.schemas';
import { ContractsService } from './contracts.service';
import { DisputesService } from './disputes.service';

const id = new ZodPipe(idParam);
type Id = { id: string };

function sendPdf(res: Response, f: { bytes: Buffer; name: string }) {
  res.set({ 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${f.name}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
  res.send(f.bytes);
}

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get('eimzo/status') eimzo() { return this.contracts.eimzoStatus(); }

  @Post() @Secured('contracts.create') create(@Me() u: AuthUser, @Body(new ZodPipe(contractCreateSchema)) b: z.infer<typeof contractCreateSchema>) { return this.contracts.createManual(u, b); }
  @Get() @Secured('contracts.create') list(@Me() u: AuthUser, @Query(new ZodPipe(contractListQuery)) q: PageQuery & { as: 'buyer' | 'seller'; status?: ContractStatus; archive: boolean }) { return this.contracts.list(u, q); }
  @Get('by-order/:id') @Secured('contracts.create') byOrder(@Me() u: AuthUser, @Param(id) p: Id) { return this.contracts.forOrder(u, p.id); }
  @Get(':id') @Secured() detail(@Me() u: AuthUser, @Param(id) p: Id) { return this.contracts.detail(u, p.id); }
  @Get(':id/pdf') @Secured()
  async pdf(@Me() u: AuthUser, @Param(id) p: Id, @Query(new ZodPipe(versionQuery)) q: { version?: number }, @Res() res: Response) { sendPdf(res, await this.contracts.pdf(u, p.id, q.version)); }
  @Get(':id/bundle') @Secured() bundle(@Me() u: AuthUser, @Param(id) p: Id) { return this.contracts.bundle(u, p.id); }
  @Get(':id/signing-info') @Secured('contracts.sign') info(@Me() u: AuthUser, @Param(id) p: Id) { return this.contracts.signingInfo(u, p.id); }
  @Post(':id/sign') @Secured('contracts.sign') sign(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(signSchema)) b: z.infer<typeof signSchema>) { return this.contracts.sign(u, p.id, b); }

  @Patch(':id/terms') @Secured('contracts.create') terms(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(contractTermsUpdateSchema)) b: z.infer<typeof contractTermsUpdateSchema>) { return this.contracts.updateTerms(u, p.id, b.terms); }
  @Patch(':id/order-terms') @Secured('contracts.create') orderTerms(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(orderContractTermsSchema)) b: z.infer<typeof orderContractTermsSchema>) { return this.contracts.updateOrderContract(u, p.id, b); }
  @Post(':id/reopen') @Secured('contracts.create') reopen(@Me() u: AuthUser, @Param(id) p: Id) { return this.contracts.reopen(u, p.id); }
  @Post(':id/submit') @Secured('contracts.create') submit(@Me() u: AuthUser, @Param(id) p: Id) { return this.contracts.submit(u, p.id); }
  @Post(':id/cancel') @Secured('contracts.create') cancel(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(reasonSchema)) b: { reason: string }) { return this.contracts.cancel(u, p.id, b.reason); }
}

@ApiTags('contracts-moderation')
@Controller('moderation/contracts')
export class ContractsModerationController {
  constructor(private readonly contracts: ContractsService) {}
  @Get() @Secured('contracts.review') queue(@Query(new ZodPipe(queueQuery)) q: PageQuery) { return this.contracts.queue(q); }
  @Post(':id') @Secured('contracts.review') decide(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(contractDecisionSchema)) b: z.infer<typeof contractDecisionSchema>) { return this.contracts.decide(u, p.id, b); }
}

@ApiTags('delivery-act')
@Controller('orders')
export class DeliveryActController {
  constructor(private readonly contracts: ContractsService) {}
  @Get(':id/delivery-act') @Secured()
  async act(@Me() u: AuthUser, @Param(id) p: Id, @Res() res: Response) { sendPdf(res, await this.contracts.deliveryAct(u, p.id)); }
}

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}
  @Post() @Secured('complaints.create') open(@Me() u: AuthUser, @Body(new ZodPipe(disputeCreateSchema)) b: z.infer<typeof disputeCreateSchema>) { return this.disputes.open(u, b); }
  @Get() @Secured() list(@Me() u: AuthUser, @Query(new ZodPipe(disputeListQuery)) q: PageQuery & { status?: string }) { return this.disputes.list(u, q); }
  @Get(':id') @Secured() detail(@Me() u: AuthUser, @Param(id) p: Id) { return this.disputes.detail(u, p.id); }
  @Post(':id/notes') @Secured() note(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(disputeNoteSchema)) b: z.infer<typeof disputeNoteSchema>) { return this.disputes.addNote(u, p.id, b); }
  @Post(':id/appeal') @Secured('complaints.create') appeal(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(reasonSchema)) b: { reason: string }) { return this.disputes.appeal(u, p.id, b.reason); }
  @Post(':id/take') @Secured('disputes.resolve') take(@Me() u: AuthUser, @Param(id) p: Id) { return this.disputes.take(u, p.id); }
  @Post(':id/resolve') @Secured('disputes.resolve') resolve(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(disputeResolveSchema)) b: z.infer<typeof disputeResolveSchema>) { return this.disputes.resolve(u, p.id, b); }
}
