import { BadRequestException, Body, Controller, Post, Req, Res } from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { PhoneSignInService } from "./phone-sign-in.service";
import { SignUpService } from "./sign-up.service";

const signInPhoneSchema = z.object({
  phone: z.string().regex(/^\+\d{8,15}$/, "phone must be E.164, e.g. +2348012345678"),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional().default(false),
});

const eighteenYearsAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
};

/**
 * Combined signup: the wizard's "account" and "about you" steps are one screen,
 * so account creation + profile details arrive together and are handled in one
 * atomic server call. Better Auth still owns the password rules (min length,
 * uniqueness), so we validate only shape here and let it reject the rest.
 */
const signUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
  displayName: z.string().trim().min(3).max(30),
  username: z
    .string()
    .trim()
    .transform((s) => s.replace(/^@/, "").toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9_]{3,30}$/, "username: 3-30 letters, numbers or underscores")),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "country must be ISO 3166-1 alpha-2")
    .nullish(),
  state: z.string().trim().min(1).max(80).nullish(),
  city: z.string().trim().min(1).max(80).nullish(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
    .refine((s) => !Number.isNaN(new Date(s).getTime()), "dateOfBirth must be a real date")
    .refine((s) => new Date(s) <= eighteenYearsAgo(), "You must be 18 or older to join")
    .nullish(),
  gender: z.string().trim().min(1).max(20).nullish(),
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, "phone must be E.164, e.g. +2348012345678")
    .nullish(),
});

@Controller("auth-ext")
export class AuthExtController {
  constructor(
    private readonly phoneSignIn: PhoneSignInService,
    private readonly signUp: SignUpService,
  ) {}

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

  @Post("sign-up")
  async signUpCombined(@Req() req: Request, @Res() res: ExpressResponse, @Body() body: unknown) {
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten().fieldErrors);
    }
    const { email, password, displayName, username, ...about } = parsed.data;

    const result = await this.signUp.signUpWithProfile(
      { email, password, displayName, username },
      {
        country: about.country ?? null,
        state: about.state ?? null,
        city: about.city ?? null,
        dateOfBirth: about.dateOfBirth ?? null,
        gender: about.gender ?? null,
        phone: about.phone ?? null,
      },
      fromNodeHeaders(req.headers),
    );

    if (result.cookies.length > 0) res.setHeader("set-cookie", result.cookies);
    res
      .status(result.status)
      .type("application/json")
      .send(result.body.length > 0 ? result.body : "{}");
  }
}
