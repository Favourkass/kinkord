import {
  BadRequestException,
  Controller,
  Get,
  Delete,
  Body,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { NotificationsService } from "./notifications.service";

import { REPORT_REASONS, REPORT_DETAILS_MAX } from "../safety/dto";

const reportNotificationSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
});

const querySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  type: z.enum(["comment", "mention"]).optional(),
  unread: z.enum(["true", "false"]).optional(),
  /** Searches the whole inbox, not just what the app has loaded. */
  q: z.string().trim().max(64).optional(),
});

@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly inbox: NotificationsService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid notification query.");
    return this.inbox.list(req.user.id, {
      cursor: parsed.data.cursor,
      unreadOnly: parsed.data.unread === "true",
      type: parsed.data.type,
      q: parsed.data.q || undefined,
    });
  }

  @Get("counts")
  counts(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid notification query.");
    return this.inbox.counts(req.user.id, parsed.data.unread === "true");
  }

  @Get("unread-count")
  unreadCount(@Req() req: AuthedRequest) {
    return this.inbox.unreadCount(req.user.id);
  }

  @Delete(":id")
  delete(@Req() req: AuthedRequest, @Param("id") id: string) {
    if (!z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Invalid notification id.");
    return this.inbox.delete(req.user.id, id);
  }

  @Post(":id/report")
  report(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    if (!z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Invalid notification id.");
    const input = reportNotificationSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException(
        "Choose a report reason and keep details under 1000 characters.",
      );
    return this.inbox.report(req.user.id, id, input.data);
  }

  @Post("read-all")
  readAll(@Req() req: AuthedRequest) {
    return this.inbox.readAll(req.user.id);
  }

  @Post(":id/read")
  read(@Req() req: AuthedRequest, @Param("id") id: string) {
    if (!z.string().uuid().safeParse(id).success)
      throw new BadRequestException("Invalid notification id.");
    return this.inbox.read(req.user.id, id);
  }
}
