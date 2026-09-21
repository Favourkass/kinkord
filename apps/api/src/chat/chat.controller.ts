import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { ChatService } from "./chat.service";
import { historyQuerySchema, markReadSchema, presenceQuerySchema, startDmSchema } from "./dto";
import { PresenceRedisService } from "./presence-redis.service";

@Controller("chat")
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly presence: PresenceRedisService,
  ) {}

  @Get("conversations")
  list(@Req() req: AuthedRequest) {
    return this.chat.listConversations(req.user.id);
  }

  @Post("conversations")
  async start(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = startDmSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("userId is required.");
    const id = await this.chat.startDm(req.user.id, parsed.data.userId);
    return { conversationId: id };
  }

  @Get("conversations/:id/messages")
  async history(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Query() query: Record<string, string>,
  ) {
    const parsed = historyQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid pagination.");
    return this.chat.history(req.user.id, id, parsed.data.before, parsed.data.limit);
  }

  @Post("conversations/:id/read")
  async read(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    const parsed = markReadSchema.safeParse({ ...(body as object), conversationId: id });
    if (!parsed.success) throw new BadRequestException("messageId is required.");
    await this.chat.markRead(req.user.id, id, parsed.data.messageId);
    return { ok: true };
  }

  /** Batch presence: `?userIds=a,b,c` — one pipelined Redis round-trip. */
  @Get("presence")
  async batchPresence(@Query() query: Record<string, string>) {
    const parsed = presenceQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("userIds is required.");
    const online = await this.presence.onlineAmong(parsed.data.userIds);
    return { online };
  }
}
