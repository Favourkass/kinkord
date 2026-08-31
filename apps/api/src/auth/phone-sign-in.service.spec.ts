import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { type Db } from "../db/db.module";
import { type Auth } from "./auth.instance";
import { PhoneSignInService } from "./phone-sign-in.service";

const makeService = (rows: Array<{ email: string }>) => {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin }));
  const select = vi.fn(() => ({ from }));
  const signInEmail = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  const db = { select } as unknown as Db;
  const auth = { api: { signInEmail } } as unknown as Auth;
  return { service: new PhoneSignInService(db, auth), signInEmail };
};

const input = { phone: "+2348035550142", password: "supersecret123", rememberMe: true };

describe("PhoneSignInService", () => {
  it("rejects unknown phone numbers with a generic message", async () => {
    const { service, signInEmail } = makeService([]);
    await expect(service.signInWithPhone(input, new Headers())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("rejects ambiguous phone numbers shared by two accounts", async () => {
    const { service, signInEmail } = makeService([{ email: "a@x.dev" }, { email: "b@x.dev" }]);
    await expect(service.signInWithPhone(input, new Headers())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("delegates a unique match to Better Auth email sign-in", async () => {
    const { service, signInEmail } = makeService([{ email: "tega@x.dev" }]);
    const headers = new Headers({ origin: "http://localhost:3100" });
    const response = await service.signInWithPhone(input, headers);
    expect(response.status).toBe(200);
    expect(signInEmail).toHaveBeenCalledWith({
      body: { email: "tega@x.dev", password: "supersecret123", rememberMe: true },
      headers,
      asResponse: true,
    });
  });
});
