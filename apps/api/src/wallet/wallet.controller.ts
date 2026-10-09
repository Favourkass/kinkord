import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { AdminGuard } from "../moderation/admin.guard";
import { isSuperAdmin } from "../moderation/admins";
import { parse, paymentId } from "../subscriptions/subscriptions.controller";
import {
  walletBankSchema,
  walletGiftSchema,
  walletDecisionSchema,
  walletProofSchema,
  walletQuerySchema,
  walletRequestSchema,
  walletSettingsSchema,
  withdrawalSchema,
} from "./dto";
import { WalletGiftsService } from "./wallet-gifts.service";
import { WalletService, walletOperationDto } from "./wallet.service";
const uploadSchema = z.object({
  contentType: z.string(),
  contentLength: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
});
@Controller("wallet")
@UseGuards(AuthGuard)
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly gifts: WalletGiftsService,
  ) {}
  @Get() async status(@Req() req: AuthedRequest) {
    return {
      settings: await this.wallet.settings(),
      balances: await this.wallet.balances(req.user.id),
      redemption: await this.wallet.redemptionEligibility(req.user.id),
    };
  }
  @Get("banks") banks(@Req() req: AuthedRequest) {
    return this.wallet.banks(req.user.id);
  }
  @Post("banks") addBank(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.wallet.addBank(req.user.id, parse(walletBankSchema, body));
  }
  @Put("banks/:id/default") defaultBank(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.wallet.changeBank(req.user.id, paymentId(id), false);
  }
  @Delete("banks/:id") removeBank(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.wallet.changeBank(req.user.id, paymentId(id), true);
  }
  @Get("history") history(@Req() req: AuthedRequest) {
    return this.wallet.history(req.user.id);
  }
  @Get("operations/:id") async operation(@Req() req: AuthedRequest, @Param("id") id: string) {
    return walletOperationDto(await this.wallet.operation(req.user.id, paymentId(id)));
  }
  @Post("gifts") gift(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.gifts.send(req.user.id, parse(walletGiftSchema, body));
  }
  @Post("purchases") purchase(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.wallet.create(req.user.id, "purchase", parse(walletRequestSchema, body));
  }
  @Post("withdrawals") withdrawal(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.wallet.create(req.user.id, "withdrawal", parse(withdrawalSchema, body));
  }
  @Post("operations/:id/receipt-upload-url") upload(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parse(uploadSchema, body);
    return this.wallet.receiptUpload(
      req.user.id,
      paymentId(id),
      input.contentType,
      input.contentLength,
    );
  }
  @Post("operations/:id/submit") submit(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.wallet.submit(req.user.id, paymentId(id), parse(walletProofSchema, body));
  }
}
@Controller("admin/wallet")
@UseGuards(AuthGuard, AdminGuard)
export class AdminWalletController {
  constructor(private readonly wallet: WalletService) {}
  @Get() queue(@Query() query: unknown) {
    const q = parse(walletQuerySchema, query);
    return this.wallet.queue(q.kind, q.status);
  }
  @Get("settings") settings(@Req() req: AuthedRequest) {
    return this.wallet
      .settings()
      .then((settings) => ({ ...settings, canEdit: isSuperAdmin(req.user) }));
  }
  @Put("settings") save(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!isSuperAdmin(req.user))
      throw new ForbiddenException("Only the founders can change wallet rates.");
    return this.wallet.saveSettings(req.user.id, parse(walletSettingsSchema, body));
  }
  @Post(":id/decision") decide(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.wallet.decide(req.user.id, paymentId(id), parse(walletDecisionSchema, body));
  }
}
