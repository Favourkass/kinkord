import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { usernameParamSchema } from "../members/follows.controller";
import { RelationshipsService } from "./relationships.service";

const requestSchema = z
  .object({
    username: usernameParamSchema,
    type: z.string().trim().min(1).max(40),
  })
  .strict();

@Controller("relationships")
@UseGuards(AuthGuard)
export class RelationshipsController {
  constructor(private readonly relationships: RelationshipsService) {}

  /** The links the request form offers. Declared before :id. */
  @Get("options")
  options() {
    return this.relationships.options();
  }

  /** Your links, and the requests waiting on you or on the other member. */
  @Get()
  list(@Req() req: AuthedRequest) {
    return this.relationships.list(req.user.id);
  }

  @Post()
  request(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Choose a relationship and a member.");
    return this.relationships.request(req.user.id, parsed.data.username, parsed.data.type);
  }

  @Post(":id/accept")
  accept(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.relationships.accept(req.user.id, id);
  }

  /** Declines or cancels a request, or ends a link. */
  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.relationships.remove(req.user.id, id);
  }
}
