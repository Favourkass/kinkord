import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { BlocksService } from "./blocks.service";
import { blockSchema, reportSchema } from "./dto";
import { ReportsService } from "./reports.service";

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

/** A member's own safety tools: blocking someone, and reporting them to the moderators. */
@Controller()
@UseGuards(AuthGuard)
export class SafetyController {
  constructor(
    private readonly blocks: BlocksService,
    private readonly reports: ReportsService,
  ) {}

  @Post("blocks")
  async block(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { userId } = parse(blockSchema, body);
    await this.blocks.block(req.user.id, userId);
    return { blocked: userId };
  }

  @Delete("blocks/:userId")
  async unblock(@Req() req: AuthedRequest, @Param("userId") userId: string) {
    const { userId: id } = parse(blockSchema, { userId });
    await this.blocks.unblock(req.user.id, id);
    return { unblocked: id };
  }

  @Post("reports")
  async report(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.reports.create(req.user.id, parse(reportSchema, body));
  }
}
