import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { ChatService } from "./chat.service";
import { historyQuerySchema, markReadSchema, sendMessageSchema, startDmSchema } from "./dto";

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

/**
 * Plain request/response on purpose: App Runner can't hold WebSockets open, so
 * an open thread asks for anything newer than its last message every few
 * seconds. Instant delivery is a later switch that needs new AWS services.
 */
@Controller("chat")
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get("conversations")
  list(@Req() req: AuthedRequest) {
    return this.chat.listConversations(req.user.id);
  }

  @Post("conversations")
  async start(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { userId } = parse(startDmSchema, body);
    return { conversationId: await this.chat.startDm(req.user.id, userId) };
  }

  @Get("conversations/:id")
  one(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.chat.conversation(req.user.id, id);
  }

  @Get("conversations/:id/messages")
  async history(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: unknown,
  ) {
    return this.chat.history(req.user.id, id, parse(historyQuerySchema, query));
  }

  @Post("conversations/:id/messages")
  async send(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.chat.sendMessage(req.user.id, id, parse(sendMessageSchema, body));
  }

  @Post("conversations/:id/read")
  async read(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    await this.chat.markRead(req.user.id, id, parse(markReadSchema, body).messageId);
    return { ok: true };
  }
}
