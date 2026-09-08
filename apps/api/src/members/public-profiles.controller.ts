import { BadRequestException, Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { usernameParamSchema } from "./follows.controller";
import { MembersService } from "./members.service";

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
}
