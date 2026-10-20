import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { GROUP_CATEGORIES } from "./group-options";
import {
  createGroupSchema,
  createThreadSchema,
  GroupsService,
  updateGroupSchema,
} from "./groups.service";

function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{1,60}$/, "Group not found.");
const memberIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "Member not found.");
const postIdSchema = z.string().uuid("Discussion not found.");
const page = z.coerce.number().int().min(1).max(500).default(1);

const listSchema = z.object({
  view: z.enum(["mine", "near", "popular", "new"]).default("popular"),
  q: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => v || undefined),
  category: z.enum(GROUP_CATEGORIES).optional(),
  page,
});
const membersSchema = z.object({ status: z.enum(["active", "pending"]).default("active"), page });
const threadsSchema = z.object({ cursor: z.string().trim().min(1).max(64).optional() });
const roleSchema = z.object({ role: z.enum(["moderator", "member"]) }).strict();
const pinSchema = z.object({ pinned: z.boolean() }).strict();
const closeSchema = z.object({ closed: z.boolean() }).strict();

/** Groups: browsing, joining, running one, and its discussions. Signed-in members only. */
@Controller("groups")
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  /** Declared before ":slug" so "options" is never read as a group's address. */
  @Get("options")
  options(@Req() req: AuthedRequest) {
    return this.groups.options(req.user);
  }

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: unknown) {
    return this.groups.list(req.user.id, parse(listSchema, query));
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.groups.create(req.user, parse(createGroupSchema, body));
  }

  @Get(":slug")
  detail(@Req() req: AuthedRequest, @Param("slug") slug: string) {
    return this.groups.detail(req.user.id, parse(slugSchema, slug));
  }

  @Patch(":slug")
  update(@Req() req: AuthedRequest, @Param("slug") slug: string, @Body() body: unknown) {
    return this.groups.update(req.user, parse(slugSchema, slug), parse(updateGroupSchema, body));
  }

  /** The owner closes the group down. */
  @Delete(":slug")
  archive(@Req() req: AuthedRequest, @Param("slug") slug: string) {
    return this.groups.archive(req.user.id, parse(slugSchema, slug));
  }

  @Post(":slug/join")
  join(@Req() req: AuthedRequest, @Param("slug") slug: string) {
    return this.groups.join(req.user.id, parse(slugSchema, slug));
  }

  /** Leave the group, or take back a request to join it. */
  @Delete(":slug/membership")
  leave(@Req() req: AuthedRequest, @Param("slug") slug: string) {
    return this.groups.leave(req.user.id, parse(slugSchema, slug));
  }

  @Get(":slug/members")
  members(@Req() req: AuthedRequest, @Param("slug") slug: string, @Query() query: unknown) {
    return this.groups.members(req.user.id, parse(slugSchema, slug), parse(membersSchema, query));
  }

  @Post(":slug/members/:userId/approve")
  approve(@Req() req: AuthedRequest, @Param("slug") slug: string, @Param("userId") userId: string) {
    return this.groups.approve(req.user.id, parse(slugSchema, slug), parse(memberIdSchema, userId));
  }

  /** Decline a request, or remove a member. */
  @Delete(":slug/members/:userId")
  removeMember(
    @Req() req: AuthedRequest,
    @Param("slug") slug: string,
    @Param("userId") userId: string,
  ) {
    return this.groups.removeMember(
      req.user.id,
      parse(slugSchema, slug),
      parse(memberIdSchema, userId),
    );
  }

  @Put(":slug/members/:userId/role")
  setRole(
    @Req() req: AuthedRequest,
    @Param("slug") slug: string,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ) {
    return this.groups.setRole(
      req.user.id,
      parse(slugSchema, slug),
      parse(memberIdSchema, userId),
      parse(roleSchema, body).role,
    );
  }

  @Get(":slug/threads")
  threads(@Req() req: AuthedRequest, @Param("slug") slug: string, @Query() query: unknown) {
    return this.groups.threads(
      req.user.id,
      parse(slugSchema, slug),
      parse(threadsSchema, query).cursor,
    );
  }

  @Post(":slug/threads")
  createThread(@Req() req: AuthedRequest, @Param("slug") slug: string, @Body() body: unknown) {
    return this.groups.createThread(
      req.user.id,
      parse(slugSchema, slug),
      parse(createThreadSchema, body),
    );
  }

  @Get(":slug/threads/:postId")
  thread(@Req() req: AuthedRequest, @Param("slug") slug: string, @Param("postId") postId: string) {
    return this.groups.thread(req.user.id, parse(slugSchema, slug), parse(postIdSchema, postId));
  }

  @Post(":slug/threads/:postId/pin")
  pin(
    @Req() req: AuthedRequest,
    @Param("slug") slug: string,
    @Param("postId") postId: string,
    @Body() body: unknown,
  ) {
    return this.groups.setPinned(
      req.user.id,
      parse(slugSchema, slug),
      parse(postIdSchema, postId),
      parse(pinSchema, body).pinned,
    );
  }

  @Post(":slug/threads/:postId/close")
  close(
    @Req() req: AuthedRequest,
    @Param("slug") slug: string,
    @Param("postId") postId: string,
    @Body() body: unknown,
  ) {
    return this.groups.setClosed(
      req.user.id,
      parse(slugSchema, slug),
      parse(postIdSchema, postId),
      parse(closeSchema, body).closed,
    );
  }

  @Delete(":slug/threads/:postId")
  removeThread(
    @Req() req: AuthedRequest,
    @Param("slug") slug: string,
    @Param("postId") postId: string,
  ) {
    return this.groups.removeThread(
      req.user.id,
      parse(slugSchema, slug),
      parse(postIdSchema, postId),
    );
  }
}

const adminListSchema = z.object({
  status: z.enum(["all", "live", "archived"]).default("all"),
  q: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => v || undefined),
  page,
});
const archiveSchema = z.object({ archived: z.boolean() }).strict();

/** Kinkord's admins see every group and can close one down or restore it. */
@Controller("admin/groups")
@UseGuards(AuthGuard, AdminGuard)
export class AdminGroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.groups.adminList(parse(adminListSchema, query));
  }

  @Post(":id/archive")
  archive(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.groups.adminArchive(
      req.user.id,
      parse(z.string().uuid("Group not found."), id),
      parse(archiveSchema, body).archived,
    );
  }
}
