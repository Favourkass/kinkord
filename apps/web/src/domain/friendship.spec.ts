import { describe, expect, it } from "vitest";
const FRIENDSHIP_COPY = {
  add: "Add",
  requested: "Sent",
  accept: "Accept",
  decline: "Decline",
  remove: "Remove",
  cancel: "Cancel",
};
import { friendshipActions } from "./friendship";
describe("friendship actions", () => {
  it("offers explicit accept/decline only for incoming requests", () => {
    expect(friendshipActions("incoming", FRIENDSHIP_COPY)).toMatchObject({
      action: "accept",
      secondaryAction: "dismiss",
    });
    expect(friendshipActions("outgoing", FRIENDSHIP_COPY)).toMatchObject({
      action: "dismiss",
      secondaryAction: null,
    });
    expect(friendshipActions("friends", FRIENDSHIP_COPY).action).toBe("remove");
    expect(friendshipActions("none", FRIENDSHIP_COPY).action).toBe("request");
  });
});
