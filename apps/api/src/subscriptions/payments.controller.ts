import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { isSuperAdmin } from "../moderation/admins";
import { adminPaymentsQuerySchema, paymentSettingsSchema, rejectPaymentSchema } from "./dto";
import { PaymentsService } from "./payments.service";
import { parse, paymentId } from "./subscriptions.controller";

/** The admins' payment queue and decisions; where members pay is the founders' alone. */
@Controller("admin/payments")
@UseGuards(AuthGuard, AdminGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query() query: unknown) {
    const { status, q } = parse(adminPaymentsQuerySchema, query);
    return this.payments.list(status, q || undefined);
  }

  @Get("settings")
  settings(@Req() req: AuthedRequest) {
    return this.payments.settings(isSuperAdmin(req.user));
  }

  /** A changed account number sends every new payment somewhere else: founders only. */
  @Put("settings")
  updateSettings(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!isSuperAdmin(req.user)) {
      throw new ForbiddenException("Only the founders can change where members pay.");
    }
    return this.payments.updateSettings(req.user.id, parse(paymentSettingsSchema, body));
  }

  @Post(":id/verify")
  verify(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.payments.verify(req.user.id, paymentId(id));
  }

  @Post(":id/reject")
  reject(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.payments.reject(
      req.user.id,
      paymentId(id),
      parse(rejectPaymentSchema, body).reason,
    );
  }
}
