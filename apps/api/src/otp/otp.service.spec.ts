import { beforeEach, describe, expect, it, vi } from "vitest";
import { OtpService } from "./otp.service";

process.env.OTP_SECRET = "test-secret";

/** Minimal Drizzle stand-in: one in-memory challenge row plus the send-rate read. */
function makeDb(recent: Array<{ createdAt: Date }> = []) {
  const stored: Record<string, unknown>[] = [];
  const challenge = {
    id: "challenge-1",
    userId: "u1",
    channel: "sms",
    destination: "+2348012345678",
    codeHash: "not-the-right-hash",
    expiresAt: new Date(Date.now() + 60_000),
    failedAttempts: 0,
    lockedUntil: null as Date | null,
    createdAt: new Date(),
  };
  const update = vi.fn(() => ({
    set: vi.fn((values: Partial<typeof challenge>) => {
      Object.assign(challenge, values);
      return { where: vi.fn() };
    }),
  }));
  const del = vi.fn(() => ({ where: vi.fn() }));
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ for: vi.fn(async () => [challenge]) })) })),
    })),
    update,
    delete: del,
  };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(async () => recent) })) })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (row: Record<string, unknown>) => {
        stored.push(row);
      }),
    })),
    delete: del,
    transaction: vi.fn(async (run: (value: typeof tx) => Promise<unknown>) => run(tx)),
  };
  return { db, tx, challenge, update, del, stored };
}

const sms = () => ({ send: vi.fn(async () => ({ provider: "robase", providerMessageId: "1" })) });
const email = () => ({ send: vi.fn(async () => undefined) });

describe("OtpService.send", () => {
  it("stores the challenge before the code goes out", async () => {
    const { db, stored } = makeDb();
    const texter = sms();
    const service = new OtpService(db as never, email() as never, texter as never);

    const result = await service.send("u1", "sms", "+2348012345678");

    expect(stored).toHaveLength(1);
    expect(db.insert).toHaveBeenCalledBefore(texter.send as never);
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    // Only the hash is kept — never the code itself.
    expect(String(stored[0].codeHash)).toHaveLength(64);
    const sent = texter.send.mock.calls[0][0] as { message: string };
    expect(sent.message).not.toContain(String(stored[0].codeHash));
  });

  it("drops the challenge when delivery fails, so no dead code is left behind", async () => {
    const { db, del } = makeDb();
    const texter = { send: vi.fn(async () => Promise.reject(new Error("provider down"))) };
    const service = new OtpService(db as never, email() as never, texter as never);

    await expect(service.send("u1", "sms", "+2348012345678")).rejects.toThrow(
      /could not text you/i,
    );
    expect(del).toHaveBeenCalled();
  });

  it("never puts the provider's own failure in front of a member", async () => {
    const { db } = makeDb();
    // The real 2026-09-15 outage: Termii refused every send and members were
    // shown "Internal server error".
    const texter = {
      send: vi.fn(async () =>
        Promise.reject(new Error("SMS delivery failed via Termii (422) SENDER_ID_NOT_APPROVED")),
      ),
    };
    const service = new OtpService(db as never, email() as never, texter as never);

    await expect(service.send("u1", "sms", "+2348012345678")).rejects.toMatchObject({
      status: 503,
    });
    await expect(service.send("u1", "sms", "+2348012345678")).rejects.not.toThrow(/422|SENDER_ID/);
  });

  it("refuses a destination that is not a real number or address", async () => {
    const { db } = makeDb();
    const service = new OtpService(db as never, email() as never, sms() as never);

    await expect(service.send("u1", "sms", "08012345678")).rejects.toThrow(/phone number/);
    await expect(service.send("u1", "email", "nope")).rejects.toThrow(/email address/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("holds a second request inside the cooldown", async () => {
    const { db } = makeDb([{ createdAt: new Date() }]);
    const service = new OtpService(db as never, email() as never, sms() as never);

    await expect(service.send("u1", "sms", "+2348012345678")).rejects.toThrow(/wait a minute/);
  });

  it("stops after five codes in an hour", async () => {
    const old = new Date(Date.now() - 10 * 60 * 1000);
    const { db } = makeDb([old, old, old, old, old].map((createdAt) => ({ createdAt })));
    const service = new OtpService(db as never, email() as never, sms() as never);

    await expect(service.send("u1", "sms", "+2348012345678")).rejects.toThrow(/Too many codes/);
  });
});

describe("OtpService.verify", () => {
  let service: OtpService;
  let fixture: ReturnType<typeof makeDb>;

  beforeEach(() => {
    fixture = makeDb();
    service = new OtpService(fixture.db as never, email() as never, sms() as never);
  });

  it("counts down the attempts, then locks for 24 hours", async () => {
    await expect(service.verify("u1", "challenge-1", "000000")).resolves.toEqual({
      valid: false,
      attemptsLeft: 2,
    });
    await expect(service.verify("u1", "challenge-1", "000000")).resolves.toEqual({
      valid: false,
      attemptsLeft: 1,
    });
    await expect(service.verify("u1", "challenge-1", "000000")).rejects.toThrow(/24 hours/);
    expect(fixture.challenge.lockedUntil).toBeInstanceOf(Date);
  });

  it("rejects a malformed code without touching the database", async () => {
    await expect(service.verify("u1", "challenge-1", "12")).resolves.toEqual({ valid: false });
    expect(fixture.db.transaction).not.toHaveBeenCalled();
  });

  it("accepts the code that was actually sent, and spends it", async () => {
    const texter = sms();
    const issuing = new OtpService(fixture.db as never, email() as never, texter as never);
    const issued = await issuing.send("u1", "sms", "+2348012345678");

    // Read the real code out of the message the member would have received.
    const { message } = texter.send.mock.calls[0][0] as { message: string };
    const code = /\b(\d{6})\b/.exec(message)?.[1];
    expect(code).toMatch(/^\d{6}$/);

    // Point the stored row at that challenge, as the database would have.
    fixture.challenge.id = issued.id;
    fixture.challenge.codeHash = String(fixture.stored[0].codeHash);

    await expect(service.verify("u1", issued.id, code!)).resolves.toEqual({ valid: true });
    expect(fixture.del).toHaveBeenCalled(); // consumed, so it cannot be replayed
  });

  it("will not let one member redeem another member's challenge", async () => {
    const empty = {
      transaction: vi.fn(
        async (run: (value: unknown) => Promise<unknown>) =>
          await run({
            select: () => ({ from: () => ({ where: () => ({ for: async () => [] }) }) }),
          }),
      ),
    };
    const scoped = new OtpService(empty as never, email() as never, sms() as never);
    await expect(scoped.verify("someone-else", "challenge-1", "123456")).resolves.toEqual({
      valid: false,
    });
  });
});
