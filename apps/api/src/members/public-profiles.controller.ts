import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { usernameParamSchema } from "./follows.controller";
import { MembersService } from "./members.service";

const friendsQuerySchema = z.object({
  tab: z.enum(["all", "mutual"]).default("all"),
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

  /** Friends tab: `tab=all` (their mutual follows) or `tab=mutual` (friends in common with the viewer). */
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
