import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, AuthedRequest } from "./auth.guard";

@Controller()
export class MeController {
  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    const { id, email, name, emailVerified, image, createdAt } = req.user;
    return { id, email, name, emailVerified, image, createdAt };
  }
}
