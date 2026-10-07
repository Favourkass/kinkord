import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { checkoutSchema, receiptUploadSchema, submitPaymentSchema } from "./dto";
import { SubscriptionsService } from "./subscriptions.service";

export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

/** An unknown id reads as not found rather than reaching the database. */
export function paymentId(id: string): string {
  if (!z.string().uuid().safeParse(id).success) throw new BadRequestException("Unknown payment.");
  return id;
}

/** A member paying for Silver: their plan, a checkout, and the proof of their transfer. */
@Controller("subscription")
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  status(@Req() req: AuthedRequest) {
    return this.subscriptions.status(req.user);
  }

  @Post("checkout")
  checkout(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.subscriptions.checkout(req.user.id, parse(checkoutSchema, body).period);
  }

  @Get("payments/:id")
  payment(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.subscriptions.payment(req.user.id, paymentId(id));
  }

  @Post("payments/:id/receipt-upload-url")
  receiptUploadUrl(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    const { contentType, contentLength } = parse(receiptUploadSchema, body);
    return this.subscriptions.presignReceipt(
      req.user.id,
      paymentId(id),
      contentType,
      contentLength,
    );
  }

  @Post("payments/:id/submit")
  submit(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.subscriptions.submit(req.user.id, paymentId(id), parse(submitPaymentSchema, body));
  }
}
