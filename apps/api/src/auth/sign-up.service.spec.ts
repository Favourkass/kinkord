import { describe, expect, it, vi } from "vitest";
import { InternalServerErrorException } from "@nestjs/common";
import { type Db } from "../db/db.module";
import { type Auth } from "./auth.instance";
import { SignUpService } from "./sign-up.service";

const account = {
  email: "tega@kinkord.com",
  password: "supersecret123",
  displayName: "Sir T",
  username: "tegamaxwell",
};
const fields = {
  country: "NG",
  state: "Delta",
  city: "Sapele",
  dateOfBirth: "1999-08-04",
  gender: "male",
  phone: "+2348031234567",
};

const make = (opts: { signUpResponse: Response; updateThrows?: boolean }) => {
  const setWhere = opts.updateThrows
    ? vi.fn().mockRejectedValue(new Error("db down"))
    : vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where: setWhere }));
  const update = vi.fn(() => ({ set }));

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn(() => ({ where: deleteWhere }));

  const limit = vi.fn().mockResolvedValue([{ id: "u1" }]);
  const selectWhere = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));

  const db = { update, delete: del, select } as unknown as Db;
  const signUpEmail = vi.fn().mockResolvedValue(opts.signUpResponse);
  const auth = { api: { signUpEmail } } as unknown as Auth;
  return { service: new SignUpService(db, auth), update, set, del, deleteWhere, signUpEmail };
};

describe("SignUpService", () => {
  it("forwards Better Auth's rejection and never touches the profile", async () => {
    const res = new Response(JSON.stringify({ message: "Email already exists" }), { status: 422 });
    const { service, update } = make({ signUpResponse: res });

    const result = await service.signUpWithProfile(account, fields, new Headers());

    expect(result.status).toBe(422);
    expect(result.body).toContain("Email already exists");
    expect(update).not.toHaveBeenCalled();
  });

  it("writes the about-fields onto the new profile and forwards the session", async () => {
    const res = new Response(JSON.stringify({ user: { id: "u1" }, token: "t" }), {
      status: 200,
      headers: { "set-cookie": "kinkord.session_token=abc; Path=/" },
    });
    const { service, update, set } = make({ signUpResponse: res });

    const result = await service.signUpWithProfile(account, fields, new Headers());

    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(fields);
    expect(result.status).toBe(200);
    expect(result.cookies).toEqual(["kinkord.session_token=abc; Path=/"]);
    expect(result.body).toContain("u1");
  });

  it("rolls the account back if the profile write fails", async () => {
    const res = new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 });
    const { service, del, deleteWhere } = make({ signUpResponse: res, updateThrows: true });

    await expect(service.signUpWithProfile(account, fields, new Headers())).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(del).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });
});
