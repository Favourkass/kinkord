import { Body, Controller, Get, Header, Patch, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, AuthedRequest } from "../auth/auth.guard";
import { PrivacyService } from "./privacy.service";
@Controller("privacy")
@UseGuards(AuthGuard)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  get(@Req() req: AuthedRequest) {
    return this.privacy.get(req.user.id);
  }
  @Patch()
  update(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.privacy.update(req.user.id, body);
  }
}
