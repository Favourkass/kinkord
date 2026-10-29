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
import { GroupsService, createGroupSchema, groupShareSchema } from "./groups.service";
function id(value: string) {
  const p = z.string().uuid().safeParse(value);
  if (!p.success) throw new BadRequestException("Invalid ID.");
  return p.data;
}
@Controller("groups")
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}
  @Get("friends") friends(@Req() req: AuthedRequest, @Query("q") q?: string) {
    return this.groups.friends(req.user.id, typeof q === "string" ? q : "");
  }
  @Get() list(@Req() req: AuthedRequest) {
    return this.groups.list(req.user.id);
  }
  @Post() create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const p = createGroupSchema.safeParse(body);
    if (!p.success) throw new BadRequestException("Enter a group name and up to 50 friends.");
    return this.groups.create(req.user.id, p.data);
  }
  @Post(":id/invitations")
  invite(@Req() req: AuthedRequest, @Param("id") value: string, @Body() body: unknown) {
    const p = z
      .object({ friends: z.array(z.string().min(1).max(128)).min(1).max(50) })
      .safeParse(body);
    if (!p.success) throw new BadRequestException("Choose up to 50 friends.");
    return this.groups.invite(req.user.id, id(value), p.data.friends);
  }
  @Delete(":id/members/:memberId")
  removeMember(
    @Req() req: AuthedRequest,
    @Param("id") value: string,
    @Param("memberId") memberId: string,
  ) {
    return this.groups.removeMember(req.user.id, id(value), memberId);
  }
  @Post(":id/accept") accept(@Req() req: AuthedRequest, @Param("id") value: string) {
    return this.groups.accept(req.user.id, id(value));
  }
  @Delete(":id/membership") leave(@Req() req: AuthedRequest, @Param("id") value: string) {
    return this.groups.leave(req.user.id, id(value));
  }
  @Delete(":id") remove(@Req() req: AuthedRequest, @Param("id") value: string) {
    return this.groups.remove(req.user.id, id(value));
  }
  @Get(":id/posts") feed(
    @Req() req: AuthedRequest,
    @Param("id") value: string,
    @Query("page") page?: string,
  ) {
    const p = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .safeParse(page ?? 1);
    if (!p.success) throw new BadRequestException("Invalid page.");
    return this.groups.feed(req.user.id, id(value), p.data);
  }
  @Post(":id/posts") share(
    @Req() req: AuthedRequest,
    @Param("id") value: string,
    @Body() body: unknown,
  ) {
    const p = groupShareSchema.safeParse(body);
    if (!p.success)
      throw new BadRequestException("Choose a post and a caption of up to 2,000 characters.");
    return this.groups.share(req.user.id, id(value), p.data);
  }
  @Delete(":id/posts/:postId") removePost(
    @Req() req: AuthedRequest,
    @Param("id") value: string,
    @Param("postId") postId: string,
  ) {
    return this.groups.removePost(req.user.id, id(value), id(postId));
  }
}
