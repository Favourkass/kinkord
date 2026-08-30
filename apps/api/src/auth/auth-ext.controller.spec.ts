import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { AuthExtController } from "./auth-ext.controller";
import { type PhoneSignInService } from "./phone-sign-in.service";

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

const makeController = (upstream: Response) => {
  const signInWithPhone = vi.fn().mockResolvedValue(upstream);
  const controller = new AuthExtController({
    signInWithPhone,
  } as unknown as PhoneSignInService);
  return { controller, signInWithPhone };
};

describe("AuthExtController", () => {
  it("rejects malformed bodies before touching the service", async () => {
    const { controller, signInWithPhone } = makeController(new Response("{}"));
    await expect(
      controller.signInPhone(req, makeRes(), { phone: "0803", password: "x" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(signInWithPhone).not.toHaveBeenCalled();
  });

  it("forwards success responses with their cookies", async () => {
    const upstream = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "set-cookie": "kinkord.session_token=abc; Path=/",
        "content-type": "application/json",
      },
    });
    const { controller, signInWithPhone } = makeController(upstream);
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
    const { controller } = makeController(new Response("nope", { status: 401 }));
    const res = makeRes();
    await controller.signInPhone(req, res, {
      phone: "+2348035550142",
      password: "wrong",
    });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid phone number or password." });
  });
});
