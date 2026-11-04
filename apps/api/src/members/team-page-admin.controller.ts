import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { isSuperAdmin } from "../moderation/admins";
import { parse } from "../subscriptions/subscriptions.controller";
import { TEAM_TITLE_MAX, TeamPageService } from "./team-page.service";

const memberId = z.string().trim().min(1).max(64);
const titleSchema = z
  .object({
    username: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, ""))
      .pipe(z.string().min(1, "Enter their username.").max(64)),
    title: z
      .string()
      .trim()
      .min(1, "Say what they do at Kinkord.")
      .max(TEAM_TITLE_MAX, `Keep the role to ${TEAM_TITLE_MAX} characters.`),
  })
  .strict();

/** Who speaks for Kinkord on Meet the Team is the founders' call; every admin may look. */
function foundersOnly(req: AuthedRequest) {
  if (!isSuperAdmin(req.user)) {
    throw new ForbiddenException("Only the founders can change who is on Meet the Team.");
  }
}

@Controller("admin/team-page")
@UseGuards(AuthGuard, AdminGuard)
export class TeamPageAdminController {
  constructor(private readonly team: TeamPageService) {}

  @Get()
  async list(@Req() req: AuthedRequest) {
    return { members: await this.team.forAdmins(), canManage: isSuperAdmin(req.user) };
  }

  @Post()
  setTitle(@Req() req: AuthedRequest, @Body() body: unknown) {
    foundersOnly(req);
    const { username, title } = parse(titleSchema, body);
    return this.team.setTitle(req.user.id, username, title);
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    foundersOnly(req);
    return this.team.remove(req.user.id, parse(memberId, id));
  }
}
