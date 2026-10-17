import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { usernameParamSchema } from "./follows.controller";
import { FriendshipsService } from "./friendships.service";

@Controller("friendships")
@UseGuards(AuthGuard)
export class FriendshipsController {
  constructor(private readonly friendships: FriendshipsService) {}
  @Get("requests")
  requests(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = z
      .object({
        direction: z.enum(["incoming", "outgoing"]).default("incoming"),
        page: z.coerce.number().int().min(1).max(500).default(1),
      })
      .safeParse(query);
    if (!parsed.success) throw new BadRequestException("Invalid friend request query.");
    return this.friendships.requests(req.user.id, parsed.data.direction, parsed.data.page);
  }
  @Post(":username") request(@Req() req: AuthedRequest, @Param("username") name: string) {
    return this.friendships.request(req.user.id, this.parse(name));
  }
  @Post(":username/accept") accept(@Req() req: AuthedRequest, @Param("username") name: string) {
    return this.friendships.accept(req.user.id, this.parse(name));
  }
  @Delete(":username/request") dismiss(@Req() req: AuthedRequest, @Param("username") name: string) {
    return this.friendships.dismiss(req.user.id, this.parse(name));
  }
  @Delete(":username") remove(@Req() req: AuthedRequest, @Param("username") name: string) {
    return this.friendships.remove(req.user.id, this.parse(name));
  }
  private parse(name: string) {
    const parsed = usernameParamSchema.safeParse(name);
    if (!parsed.success) throw new BadRequestException("Invalid username.");
    return parsed.data;
  }
}
