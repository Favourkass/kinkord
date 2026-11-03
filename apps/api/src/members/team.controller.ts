import { Controller, Get } from "@nestjs/common";
import { TeamPageService } from "./team-page.service";

/** Meet the Team is public, like the rest of the About pages. */
@Controller("team")
export class TeamController {
  constructor(private readonly team: TeamPageService) {}

  @Get()
  async list() {
    return { members: await this.team.list() };
  }
}
