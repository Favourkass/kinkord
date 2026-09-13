import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { PROFILE_OPTIONS } from "./profile-options";
import { ProfilesService, updateProfileSchema } from "./profiles.service";

const usernameSchema = z.object({ username: z.string().trim().min(1).max(64) });
const mediaIdSchema = z.string().uuid();

const uploadUrlSchema = z.object({
  kind: z.enum(["avatar", "cover"]),
  contentType: z.string(),
  /** Byte size of the file about to be uploaded; signed into the URL when given. */
  contentLength: z.number().int().positive().optional(),
});

@Controller("profile")
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  getOwn(@Req() req: AuthedRequest) {
    return this.profiles.getOwn(req.user.id, req.user.name);
  }

  /** Option lists for Edit Profile pickers — the API owns them, the web only renders them. */
  @Get("options")
  @Header("Cache-Control", "private, max-age=3600")
  options() {
    return PROFILE_OPTIONS;
  }

  /** Username changes bypass Better Auth's update-user on purpose: 30-day lock lives here. */
  @Patch("username")
  changeUsername(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = usernameSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ username: ["username is required"] });
    return this.profiles.changeUsername(req.user.id, parsed.data.username);
  }

  @Patch()
  update(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    return this.profiles.updateOwn(req.user.id, parsed.data, req.user.name);
  }

  /** Media tab → tap a photo → delete (own photos only). Clears the avatar/cover if it was in use. */
  @Delete("media/:id")
  deleteMedia(@Req() req: AuthedRequest, @Param("id") id: string) {
    const parsed = mediaIdSchema.safeParse(id);
    if (!parsed.success) throw new BadRequestException("invalid media id");
    return this.profiles.deleteMedia(req.user.id, parsed.data);
  }

  @Post("upload-url")
  presignUpload(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = uploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("kind (avatar|cover) and contentType are required");
    }
    return this.profiles.presignImageUpload(
      req.user.id,
      parsed.data.kind,
      parsed.data.contentType,
      parsed.data.contentLength,
    );
  }
}
