import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CommunityService } from "./community.service";

@Controller("community")
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get("stats")
  @UseGuards(AuthGuard)
  stats() {
    return this.community.stats();
  }
}
