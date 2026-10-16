import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { user } from "../db/schema";
import { acceptedFriendship, friendshipState, orderedPair } from "./friendship-policy";
describe("friendship policy", () => {
  it("uses the same canonical pair in either direction", () => {
    expect(orderedPair("Z", "a")).toEqual({ userA: "Z", userB: "a" });
    expect(orderedPair("a", "Z")).toEqual(orderedPair("Z", "a"));
  });
  it("distinguishes pending requests, acceptance and no relationship", () => {
    expect(friendshipState(undefined, "a")).toBe("none");
    expect(friendshipState({ status: "pending", requesterId: "a" }, "a")).toBe("outgoing");
    expect(friendshipState({ status: "pending", requesterId: "a" }, "b")).toBe("incoming");
    expect(friendshipState({ status: "accepted", requesterId: "a" }, "b")).toBe("friends");
  });
  it("grants privacy access only through accepted friendship, without a follow fallback", () => {
    const query = new PgDialect().sqlToQuery(acceptedFriendship("me", user.id));
    expect(query.sql).toContain("'accepted'");
    expect(query.sql).not.toContain('"follow"');
    expect(query.params).toEqual(["me", "me"]);
  });
});
