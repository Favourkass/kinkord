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
import { RealtimeService } from "../realtime/realtime.service";
import { ChatService } from "./chat.service";
import {
  historyQuerySchema,
  markReadSchema,
  photoUploadSchema,
  sendMessageSchema,
  startDmSchema,
} from "./dto";

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
  constructor(
    private readonly chat: ChatService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get("unread-count")
  unreadCount(@Req() req: AuthedRequest) {
    return this.chat.unreadCount(req.user.id);
  }

  @Get("conversations")
  list(@Req() req: AuthedRequest) {
    return this.chat.listConversations(req.user.id);
  }

  @Post("conversations")
  async start(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { userId } = parse(startDmSchema, body);
    return { conversationId: await this.chat.startDm(req.user, userId) };
  }

  /**
   * Where this member's app opens its live connection, with a short-lived
   * token for it. `{ enabled: false }` when live delivery isn't set up, and
   * the app keeps polling.
   */
  @Get("realtime")
  async connection(@Req() req: AuthedRequest) {
    return this.realtime.connectionFor(req.user.id);
  }

  /** Today's new-chat allowance: the app warns before a first message it would refuse. */
  @Get("allowance")
  allowance(@Req() req: AuthedRequest) {
    return this.chat.allowance(req.user);
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
    return this.chat.sendMessage(req.user, id, parse(sendMessageSchema, body));
  }

  /**
   * A slot to upload one photo into, before sending it. Refused (403) until
   * the other member has written in the thread.
   */
  @Post("conversations/:id/photo-upload-url")
  async photoUpload(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const { contentType, contentLength } = parse(photoUploadSchema, body);
    return this.chat.presignPhotoUpload(req.user.id, id, contentType, contentLength);
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
