import { describe, expect, it } from "vitest";
// The Lambda AppSync calls, checked against tokens this API signs: the two
// halves of one contract, deployed separately.
import {
  authorize,
  channelFor as lambdaChannelFor,
  type AuthorizerEvent,
} from "./authorizer/index.mjs";
import { channelFor, signRealtimeToken } from "./token";

const KEY = "test-signing-key";
const NOW = Date.parse("2026-10-01T12:00:00Z");
const valid = signRealtimeToken({ sub: "u1", exp: NOW / 1000 + 600 }, KEY);

const event = (
  over: Partial<AuthorizerEvent["requestContext"]>,
  token = valid,
): AuthorizerEvent => ({
  authorizationToken: token,
  requestContext: { operation: "EVENT_CONNECT", channel: null, ...over },
});

describe("realtime authorizer", () => {
  it("lets a member connect with a token the API signed", () => {
    expect(authorize(event({}), KEY, NOW)).toEqual({ isAuthorized: true, ttlOverride: 300 });
  });

  it("lets a member subscribe to their own channel only", () => {
    expect(
      authorize(event({ operation: "EVENT_SUBSCRIBE", channel: "/chat/u1" }), KEY, NOW)
        .isAuthorized,
    ).toBe(true);
    for (const channel of ["/chat/u2", "/chat/*", "/chat/u1/extra", "/other/u1"]) {
      expect(
        authorize(event({ operation: "EVENT_SUBSCRIBE", channel }), KEY, NOW).isAuthorized,
      ).toBe(false);
    }
  });

  it("never lets a member publish", () => {
    expect(
      authorize(event({ operation: "EVENT_PUBLISH", channel: "/chat/u1" }), KEY, NOW).isAuthorized,
    ).toBe(false);
  });

  it("refuses expired, tampered and foreign tokens", () => {
    const expired = signRealtimeToken({ sub: "u1", exp: NOW / 1000 - 1 }, KEY);
    const [v, payload, sig] = valid.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "u2", exp: NOW / 1000 + 600 })).toString(
      "base64url",
    );
    for (const token of [
      expired,
      `${v}.${forged}.${sig}`, // someone else's id under our signature
      signRealtimeToken({ sub: "u1", exp: NOW / 1000 + 600 }, "another-key"),
      `v2.${payload}.${sig}`,
      "not-a-token",
    ]) {
      expect(authorize(event({}, token), KEY, NOW)).toEqual({ isAuthorized: false });
    }
    expect(authorize({ requestContext: { operation: "EVENT_CONNECT" } }, KEY, NOW)).toEqual({
      isAuthorized: false,
    });
  });

  it("never caches a yes past the token's expiry", () => {
    const soon = signRealtimeToken({ sub: "u1", exp: NOW / 1000 + 42 }, KEY);
    expect(authorize(event({}, soon), KEY, NOW).ttlOverride).toBe(42);
  });

  it("names channels exactly as the API does", () => {
    for (const id of ["jQ7THjJ6suCnKfCva1ypTvRFUzkv8qML", "u1", "has_underscore", ""]) {
      expect(lambdaChannelFor(id)).toBe(channelFor(id));
    }
  });
});
