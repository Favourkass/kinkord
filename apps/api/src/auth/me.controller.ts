import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, AuthedRequest } from "./auth.guard";

@Controller()
export class MeController {
  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    const { id, email, name, emailVerified, image, createdAt } = req.user;
    const u = req.user as typeof req.user & {
      username?: string | null;
      displayUsername?: string | null;
      twoFactorEnabled?: boolean | null;
    };
    return {
      id,
      email,
      name,
      emailVerified,
      image,
      createdAt,
      username: u.username ?? null,
      displayUsername: u.displayUsername ?? null,
      twoFactorEnabled: u.twoFactorEnabled ?? false,
    };
  }
}
