import { BadRequestException, Body, Controller, Post, Req, Res } from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { PhoneSignInService } from "./phone-sign-in.service";

const signInPhoneSchema = z.object({
  phone: z.string().regex(/^\+\d{8,15}$/, "phone must be E.164, e.g. +2348012345678"),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional().default(false),
});

@Controller("auth-ext")
export class AuthExtController {
  constructor(private readonly phoneSignIn: PhoneSignInService) {}

  @Post("sign-in-phone")
  async signInPhone(@Req() req: Request, @Res() res: ExpressResponse, @Body() body: unknown) {
    const parsed = signInPhoneSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("phone (E.164) and password are required");
    }

    const upstream = await this.phoneSignIn.signInWithPhone(
      parsed.data,
      fromNodeHeaders(req.headers),
    );

    if (upstream.status === 401 || upstream.status === 403) {
      res.status(401).json({ message: "Invalid phone number or password." });
      return;
    }

    const cookies = upstream.headers.getSetCookie();
    if (cookies.length > 0) res.setHeader("set-cookie", cookies);
    const text = await upstream.text();
    res
      .status(upstream.status)
      .type(upstream.headers.get("content-type") ?? "application/json")
      .send(text.length > 0 ? text : "{}");
  }
}
