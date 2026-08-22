import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { ProfilesService, updateProfileSchema } from "./profiles.service";

const avatarUploadSchema = z.object({ contentType: z.string() });

@Controller("profile")
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  getOwn(@Req() req: AuthedRequest) {
    return this.profiles.getOwn(req.user.id, req.user.name);
  }

  @Patch()
  update(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    return this.profiles.updateOwn(req.user.id, parsed.data, req.user.name);
  }

  @Post("avatar-upload")
  presignAvatar(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = avatarUploadSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("contentType is required");
    return this.profiles.presignAvatarUpload(req.user.id, parsed.data.contentType);
  }
}
