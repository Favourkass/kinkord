import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { channelFor, signRealtimeToken } from "./token";

describe("signRealtimeToken", () => {
  it("is v1.<payload>.<HMAC of v1.payload>, base64url throughout", () => {
    const token = signRealtimeToken({ sub: "u1", exp: 1_790_000_000 }, "key");
    const [version, payload, signature] = token.split(".");
    expect(version).toBe("v1");
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      sub: "u1",
      exp: 1_790_000_000,
    });
    expect(signature).toBe(createHmac("sha256", "key").update(`v1.${payload}`).digest("base64url"));
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("differs by key, so only our key's tokens verify", () => {
    const claims = { sub: "u1", exp: 1_790_000_000 };
    expect(signRealtimeToken(claims, "a")).not.toBe(signRealtimeToken(claims, "b"));
  });
});

describe("channelFor", () => {
  it("names a member's own channel", () => {
    expect(channelFor("jQ7THjJ6suCnKfCva1ypTvRFUzkv8qML")).toBe(
      "/chat/jQ7THjJ6suCnKfCva1ypTvRFUzkv8qML",
    );
  });

  it("refuses ids AppSync can't use as a channel segment", () => {
    for (const bad of ["", "has_underscore", "-leading", "trailing-", "a/b", "x".repeat(51)]) {
      expect(channelFor(bad)).toBeNull();
    }
  });
});
