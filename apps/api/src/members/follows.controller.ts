import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { FollowsService } from "./follows.service";

/** "@Handle" or "handle": 3–30 letters, digits, underscores (matches the username plugin). */
export const usernameParamSchema = z
  .string()
  .trim()
  .regex(/^@?[a-z0-9_]{3,30}$/i, "invalid username");

@Controller("follows")
@UseGuards(AuthGuard)
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Post(":username")
  follow(@Req() req: AuthedRequest, @Param("username") username: string) {
    return this.follows.follow(req.user.id, this.parse(username));
  }

  @Delete(":username")
  unfollow(@Req() req: AuthedRequest, @Param("username") username: string) {
    return this.follows.unfollow(req.user.id, this.parse(username));
  }

  private parse(raw: string): string {
    const parsed = usernameParamSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("invalid username");
    return parsed.data;
  }
}
