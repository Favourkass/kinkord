import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { usernameParamSchema } from "./follows.controller";
import { MembersService } from "./members.service";

const friendsQuerySchema = z.object({
  tab: z.enum(["all", "mutual", "followers", "following", "suggested"]).default("all"),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const mediaQuerySchema = z.object({
  filter: z.enum(["all", "profile", "photos", "videos"]).default("all"),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

/** Read-only view of another member. Own-profile editing stays on /profile. */
@Controller("profiles")
@UseGuards(AuthGuard)
export class PublicProfilesController {
  constructor(private readonly members: MembersService) {}

  @Get(":username")
  byUsername(@Req() req: AuthedRequest, @Param("username") username: string) {
    const parsed = usernameParamSchema.safeParse(username);
    if (!parsed.success) throw new BadRequestException("invalid username");
    return this.members.publicProfile(parsed.data, req.user.id);
  }

  /** Media tab: uploaded profile photos / covers (post media joins later), filtered by pill. */
  @Get(":username/media")
  media(
    @Req() req: AuthedRequest,
    @Param("username") username: string,
    @Query() query: Record<string, string>,
  ) {
    const handle = usernameParamSchema.safeParse(username);
    if (!handle.success) throw new BadRequestException("invalid username");
    const q = mediaQuerySchema.safeParse(query);
    if (!q.success) throw new BadRequestException("invalid query");
    return this.members.media(handle.data, req.user.id, q.data.filter, q.data.page, q.data.limit);
  }

  /** People tab: friends (mutual follows), mutual-with-viewer, followers, following or suggested. */
  @Get(":username/friends")
  friends(
    @Req() req: AuthedRequest,
    @Param("username") username: string,
    @Query() query: Record<string, string>,
  ) {
    const handle = usernameParamSchema.safeParse(username);
    if (!handle.success) throw new BadRequestException("invalid username");
    const q = friendsQuerySchema.safeParse(query);
    if (!q.success) throw new BadRequestException("invalid query");
    return this.members.friends(handle.data, req.user.id, q.data.tab, q.data.page, q.data.limit);
  }
}
