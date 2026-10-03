import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { AllowDuringSignUp, AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { endpointSchema, subscriptionSchema } from "./dto";
import { PushService } from "./push.service";

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

/** Push notifications: a device signs up here, and signs off on logout. */
@Controller("push")
@UseGuards(AuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  /** The key a browser subscribes with. */
  @Get("key")
  async key() {
    return { publicKey: await this.push.publicKey() };
  }

  @Post("subscriptions")
  async subscribe(@Req() req: AuthedRequest, @Body() body: unknown) {
    const userAgent = req.headers["user-agent"]?.slice(0, 300) ?? null;
    await this.push.subscribe(req.user.id, parse(subscriptionSchema, body), userAgent);
    return { ok: true };
  }

  /** Allowed before phone verification too: logging out always cleans up the device. */
  @Post("subscriptions/remove")
  @AllowDuringSignUp()
  async unsubscribe(@Req() req: AuthedRequest, @Body() body: unknown) {
    await this.push.unsubscribe(req.user.id, parse(endpointSchema, body).endpoint);
    return { ok: true };
  }

  /** A notification to the member's own devices, so turning them on shows they work. */
  @Post("test")
  async test(@Req() req: AuthedRequest) {
    const sent = await this.push.deliver(
      req.user.id,
      { type: "test" },
      {
        title: "Kinkord",
        body: "Notifications are on. You'll hear about messages, followers and activity on your posts.",
        url: "/settings",
        tag: "test",
      },
    );
    return { sent };
  }
}
