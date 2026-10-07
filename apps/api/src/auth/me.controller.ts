import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { AllowDuringSignUp, AuthGuard, AuthedRequest } from "./auth.guard";

@Controller()
export class MeController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get("me")
  @UseGuards(AuthGuard)
  @AllowDuringSignUp()
  async me(@Req() req: AuthedRequest) {
    const { id, email, name, emailVerified, image, createdAt } = req.user;
    const u = req.user as typeof req.user & {
      username?: string | null;
      displayUsername?: string | null;
      twoFactorEnabled?: boolean | null;
    };
    // The plan decides limits the app shows before asking, like a post's length.
    const silver = await this.subscriptions.silverUntil(id);
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
      plan: silver ? ("silver" as const) : ("basic" as const),
      silverUntil: silver?.toISOString() ?? null,
    };
  }
}
