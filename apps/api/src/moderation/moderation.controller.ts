import {
  BadRequestException,
  Body,
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
import { AdminGuard } from "./admin.guard";
import { ModerationService } from "./moderation.service";

const reasonSchema = z.string().trim().max(300).nullish();

const blockSchema = z.object({
  reason: reasonSchema,
  deletePosts: z.boolean().optional(),
});

const ruleSchema = z.object({
  kind: z.enum(["email", "phone", "ip", "name"]),
  value: z.string().trim().min(1).max(320),
  action: z.enum(["block", "flag"]),
  reason: reasonSchema,
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

@Controller("admin")
@UseGuards(AuthGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  /** Lets the app decide whether to show the admin entry point. Any member may ask. */
  @Get("access")
  async access(@Req() req: AuthedRequest) {
    return { isAdmin: await this.moderation.isAdmin(req.user) };
  }

  @Get("members")
  @UseGuards(AdminGuard)
  search(@Query("q") q?: string) {
    return this.moderation.searchMembers(q ?? "");
  }

  @Get("members/:id")
  @UseGuards(AdminGuard)
  member(@Param("id") id: string) {
    return this.moderation.member(id);
  }

  @Post("members/:id/block")
  @UseGuards(AdminGuard)
  async block(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.moderation.block(req.user.id, id, parse(blockSchema, body ?? {}));
  }

  @Post("members/:id/unblock")
  @UseGuards(AdminGuard)
  unblock(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.moderation.unblock(req.user.id, id);
  }

  /** `?block=1` also stops them signing up again with the same email or phone. */
  @Delete("members/:id")
  @UseGuards(AdminGuard)
  async deleteMember(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Query("block") block?: string,
    @Query("reason") reason?: string,
  ) {
    return this.moderation.deleteMember(req.user.id, id, {
      block: block === "1" || block === "true",
      reason: parse(reasonSchema, reason),
    });
  }

  @Delete("members/:id/posts")
  @UseGuards(AdminGuard)
  deleteMemberPosts(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.moderation.deleteMemberPosts(req.user.id, id);
  }

  @Delete("posts/:id")
  @UseGuards(AdminGuard)
  deletePost(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.moderation.deletePost(req.user.id, id);
  }

  @Get("blocklist")
  @UseGuards(AdminGuard)
  rules() {
    return this.moderation.rules();
  }

  @Post("blocklist")
  @UseGuards(AdminGuard)
  async addRule(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.moderation.addRule(req.user.id, parse(ruleSchema, body ?? {}));
  }

  @Delete("blocklist/:id")
  @UseGuards(AdminGuard)
  removeRule(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.moderation.removeRule(req.user.id, id);
  }
}
