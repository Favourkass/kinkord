import { describe, expect, it, vi } from "vitest";
import { OtpService } from "./otp.service";

function makeDb() {
  const challenge = {
    id: "challenge-1",
    channel: "email",
    destination: "member@example.com",
    codeHash: "not-the-code",
    expiresAt: new Date(Date.now() + 60_000),
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
  };
  const update = vi.fn(() => ({
    set: vi.fn((values: Partial<typeof challenge>) => {
      Object.assign(challenge, values);
      return { where: vi.fn() };
    }),
  }));
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ for: vi.fn(async () => [challenge]) })),
      })),
    })),
    update,
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
  return {
    challenge,
    update,
    db: {
      transaction: vi.fn(async (callback: (value: typeof tx) => Promise<boolean>) => callback(tx)),
    },
  };
}

describe("OtpService", () => {
  it("locks a challenge after three failed codes", async () => {
    const { db, challenge, update } = makeDb();
    const service = new OtpService(
      db as never,
      { send: vi.fn() } as never,
      { send: vi.fn() } as never,
    );

    await expect(service.verify("email", challenge.id, "000000")).resolves.toBe(false);
    await expect(service.verify("email", challenge.id, "000000")).resolves.toBe(false);
    await expect(service.verify("email", challenge.id, "000000")).rejects.toThrow("24 hours");
    expect(update).toHaveBeenCalledTimes(3);
  });

  it("rejects malformed email and phone destinations before delivery", async () => {
    const db = {
      select: vi.fn(),
    };
    const service = new OtpService(
      db as never,
      { send: vi.fn() } as never,
      { send: vi.fn() } as never,
    );

    await expect(service.send("email", "not-an-email", "127.0.0.1")).rejects.toThrow("valid email");
    await expect(service.send("sms", "08012345678", "127.0.0.1")).rejects.toThrow("E.164");
    expect(db.select).not.toHaveBeenCalled();
  });
});
