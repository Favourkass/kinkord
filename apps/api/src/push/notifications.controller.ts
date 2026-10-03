import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { NotificationsService } from "./notifications.service";

const querySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  type: z.enum(["comment", "mention"]).optional(),
  unread: z.enum(["true", "false"]).optional(),
});

@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly inbox: NotificationsService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid notification query.");
    return this.inbox.list(
      req.user.id,
      parsed.data.cursor,
      parsed.data.unread === "true",
      parsed.data.type,
    );
  }

  @Get("unread-count")
  unreadCount(@Req() req: AuthedRequest) {
    return this.inbox.unreadCount(req.user.id);
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
