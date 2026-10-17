import {
  BadRequestException,
  Body,
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
import { AdminGuard } from "./admin.guard";
import { AdminPostsService } from "./admin-posts.service";

const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  status: z.enum(["all", "active", "archived", "deleted"]).default("all"),
});
@Controller("admin/posts")
@UseGuards(AuthGuard, AdminGuard)
export class AdminPostsController {
  constructor(private readonly posts: AdminPostsService) {}
  @Get()
  list(@Query() query: unknown) {
    const input = listSchema.safeParse(query);
    if (!input.success) throw new BadRequestException("Invalid post page or status.");
    return this.posts.list(input.data.page, input.data.status);
  }
  @Post(":id/archive")
  archive(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({ archived: z.boolean() }).strict().safeParse(body);
    if (!z.string().uuid().safeParse(id).success || !input.success)
      throw new BadRequestException("Invalid post or archive action.");
    return this.posts.archive(req.user.id, id, input.data.archived);
  }
}
