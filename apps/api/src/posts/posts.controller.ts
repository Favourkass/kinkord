import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post as HttpPost,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { createCommentSchema, PostInteractionsService } from "./post-interactions.service";
import { createPostSchema, PostsService, uploadUrlSchema } from "./posts.service";

const postIdSchema = z.string().uuid();

const feedQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
  /** The profile Posts tab: one member's posts, same visibility rules. */
  author: z.string().trim().min(1).max(64).optional(),
});

const commentsQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

@Controller("posts")
@UseGuards(AuthGuard)
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly interactions: PostInteractionsService,
  ) {}

  /** The viewer's saved posts. Declared before ":id" so "saved" is not read as an id. */
  @Get("saved")
  saved(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = feedQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.posts.savedFeed(req.user.id, {
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });
  }

  @Get("feed")
  feed(@Req() req: AuthedRequest, @Query() query: unknown) {
    const parsed = feedQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.posts.feed(req.user.id, {
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
      author: parsed.data.author,
    });
  }

  @HttpPost("upload-url")
  presignUpload(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = uploadUrlSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("contentType is required");
    return this.posts.presignMediaUpload(
      req.user.id,
      parsed.data.contentType,
      parsed.data.contentLength,
    );
  }

  @HttpPost()
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.posts.create(req.user.id, parsed.data);
  }

  @Get(":id")
  async byId(@Req() req: AuthedRequest, @Param("id") id: string) {
    const vm = await this.posts.byId(parseId(id), req.user.id);
    if (!vm) throw new NotFoundException("Post not found");
    return vm;
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.posts.remove(parseId(id), req.user.id);
  }

  @HttpPost(":id/like")
  like(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.interactions.like(parseId(id), req.user.id);
  }

  @Delete(":id/like")
  unlike(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.interactions.unlike(parseId(id), req.user.id);
  }

  @HttpPost(":id/repost")
  repost(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.posts.repost(parseId(id), req.user.id);
  }

  @Delete(":id/repost")
  unrepost(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.posts.unrepost(parseId(id), req.user.id);
  }

  @HttpPost(":id/save")
  save(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.interactions.save(parseId(id), req.user.id);
  }

  @Delete(":id/save")
  unsave(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.interactions.unsave(parseId(id), req.user.id);
  }

  @Get(":id/comments")
  comments(@Req() req: AuthedRequest, @Param("id") id: string, @Query() query: unknown) {
    const parsed = commentsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.interactions.comments(
      parseId(id),
      req.user.id,
      parsed.data.cursor,
      parsed.data.limit,
    );
  }

  @HttpPost(":id/comments")
  comment(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.interactions.comment(parseId(id), req.user.id, parsed.data.body);
  }

  /** Comments are deleted by their own id, not under the post — the id is enough. */
  @Delete("comments/:id")
  removeComment(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.interactions.removeComment(parseId(id), req.user.id);
  }
}

function parseId(id: string): string {
  const parsed = postIdSchema.safeParse(id);
  if (!parsed.success) throw new BadRequestException("invalid id");
  return parsed.data;
}
