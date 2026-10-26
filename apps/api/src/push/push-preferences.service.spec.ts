import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { PushPreferencesService } from "./push-preferences.service";

/** Each `await` on the Drizzle chain takes the next queued answer; calls are recorded. */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  return { db: chain() as never, calls };
}

const allOn = {
  messages: true,
  comments: true,
  tags: true,
  friends: true,
  likes: true,
  follows: true,
};

describe("PushPreferencesService", () => {
  it("has every kind on until the member turns one off", async () => {
    const { db } = queuedDb([[]]);
    await expect(new PushPreferencesService(db).get("u1")).resolves.toEqual({ settings: allOn });
    const off = queuedDb([[{ off: ["likes"] }]]);
    await expect(new PushPreferencesService(off.db).get("u1")).resolves.toEqual({
      settings: { ...allOn, likes: false },
    });
  });

  it("turns kinds off and back on without touching the others", async () => {
    const { db, calls } = queuedDb([[{ off: ["likes"] }], undefined]);
    const result = await new PushPreferencesService(db).update("u1", {
      follows: false,
      likes: true,
    });
    expect(result.settings).toEqual({ ...allOn, follows: false });
    expect(calls.find((c) => c.op === "values")?.args[0]).toEqual({
      userId: "u1",
      off: ["follows"],
    });
  });

  it("refuses anything but on or off for a known kind", async () => {
    const service = new PushPreferencesService(queuedDb([]).db);
    await expect(service.update("u1", { likes: "no" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update("u1", { marketing: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
