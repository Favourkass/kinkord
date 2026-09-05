import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { AuthExtController } from "./auth-ext.controller";
import { type PhoneSignInService } from "./phone-sign-in.service";
import { type SignUpService, type SignUpResult } from "./sign-up.service";

const makeRes = () => {
  const res = {
    status: vi.fn(),
    setHeader: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.type.mockReturnValue(res);
  return res as unknown as ExpressResponse & typeof res;
};

const req = { headers: { origin: "http://localhost:3100" } } as unknown as Request;

const makeController = (opts: { upstream?: Response; signUpResult?: SignUpResult } = {}) => {
  const signInWithPhone = vi.fn().mockResolvedValue(opts.upstream ?? new Response("{}"));
  const signUpWithProfile = vi
    .fn()
    .mockResolvedValue(opts.signUpResult ?? { status: 200, cookies: [], body: "{}" });
  const controller = new AuthExtController(
    { signInWithPhone } as unknown as PhoneSignInService,
    { signUpWithProfile } as unknown as SignUpService,
  );
  return { controller, signInWithPhone, signUpWithProfile };
};

const validSignUp = {
  email: "tega@kinkord.com",
  password: "supersecret123",
  displayName: "Sir T",
  username: "@TegaMaxwell",
  country: "ng",
  state: "Delta",
  city: "Sapele",
  dateOfBirth: "1999-08-04",
  gender: "male",
  phone: "+2348031234567",
};

describe("AuthExtController", () => {
  it("rejects malformed phone sign-in bodies before touching the service", async () => {
    const { controller, signInWithPhone } = makeController();
    await expect(
      controller.signInPhone(req, makeRes(), { phone: "0803", password: "x" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(signInWithPhone).not.toHaveBeenCalled();
  });

  it("forwards phone sign-in success with cookies", async () => {
    const upstream = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "set-cookie": "kinkord.session_token=abc; Path=/",
        "content-type": "application/json",
      },
    });
    const { controller, signInWithPhone } = makeController({ upstream });
    const res = makeRes();
    await controller.signInPhone(req, res, {
      phone: "+2348035550142",
      password: "supersecret123",
    });
    expect(signInWithPhone).toHaveBeenCalledWith(
      { phone: "+2348035550142", password: "supersecret123", rememberMe: false },
      expect.any(Headers),
    );
    expect(res.setHeader).toHaveBeenCalledWith("set-cookie", ["kinkord.session_token=abc; Path=/"]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
  });

  it("maps upstream auth failures to one generic 401", async () => {
    const { controller } = makeController({ upstream: new Response("nope", { status: 401 }) });
    const res = makeRes();
    await controller.signInPhone(req, res, { phone: "+2348035550142", password: "wrong" });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid phone number or password." });
  });

  it("rejects malformed combined sign-up bodies before touching the service", async () => {
    const { controller, signUpWithProfile } = makeController();
    await expect(
      controller.signUpCombined(req, makeRes(), { email: "nope", password: "x" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(signUpWithProfile).not.toHaveBeenCalled();
  });

  it("normalizes the username and forwards the combined sign-up session", async () => {
    const { controller, signUpWithProfile } = makeController({
      signUpResult: {
        status: 200,
        cookies: ["kinkord.session_token=xyz; Path=/"],
        body: JSON.stringify({ user: { id: "u1" } }),
      },
    });
    const res = makeRes();
    await controller.signUpCombined(req, res, validSignUp);

    expect(signUpWithProfile).toHaveBeenCalledWith(
      {
        email: "tega@kinkord.com",
        password: "supersecret123",
        displayName: "Sir T",
        username: "tegamaxwell",
      },
      expect.objectContaining({ country: "NG", state: "Delta", phone: "+2348031234567" }),
      expect.any(Headers),
    );
    expect(res.setHeader).toHaveBeenCalledWith("set-cookie", ["kinkord.session_token=xyz; Path=/"]);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects a sign-up whose date of birth is under 18", async () => {
    const { controller, signUpWithProfile } = makeController();
    const underage = new Date().toISOString().slice(0, 10);
    await expect(
      controller.signUpCombined(req, makeRes(), { ...validSignUp, dateOfBirth: underage }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(signUpWithProfile).not.toHaveBeenCalled();
  });
});
