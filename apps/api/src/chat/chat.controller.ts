import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { AuthUser } from '../auth/guards';
import { ZodPipe } from '../common/http';
import { Me, Secured, idParam } from '../common/util';
import { ChatService, convListQuery, historyQuery, sendSchema, startSchema } from './chat.service';

const id = new ZodPipe(idParam);
type Id = { id: string };

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}
  @Post('conversations') @Secured('chat.use') start(@Me() u: AuthUser, @Body(new ZodPipe(startSchema)) b: z.infer<typeof startSchema>) { return this.chat.start(u, b.storeId); }
  @Get('conversations') @Secured('chat.use') list(@Me() u: AuthUser, @Query(new ZodPipe(convListQuery)) q: z.infer<typeof convListQuery>) { return this.chat.list(u, q); }
  @Get('unread') @Secured('chat.use') async unread(@Me() u: AuthUser) { return { unread: await this.chat.unreadTotal(u) }; }
  @Get('conversations/:id/messages') @Secured('chat.use') history(@Me() u: AuthUser, @Param(id) p: Id, @Query(new ZodPipe(historyQuery)) q: z.infer<typeof historyQuery>) { return this.chat.history(u, p.id, q); }
  @Post('conversations/:id/messages') @Throttle({ default: { limit: 40, ttl: 60_000 } }) @Secured('chat.use') send(@Me() u: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(sendSchema)) b: z.infer<typeof sendSchema>) { return this.chat.send(u, p.id, b); }
  @Post('conversations/:id/read') @Secured('chat.use') read(@Me() u: AuthUser, @Param(id) p: Id) { return this.chat.markRead(u, p.id); }
  @Post('conversations/:id/block') @Secured('chat.use') block(@Me() u: AuthUser, @Param(id) p: Id) { return this.chat.block(u, p.id, true); }
  @Post('conversations/:id/unblock') @Secured('chat.use') unblock(@Me() u: AuthUser, @Param(id) p: Id) { return this.chat.block(u, p.id, false); }
}

@Module({ imports: [AuthModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
