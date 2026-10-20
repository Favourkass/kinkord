import { describe, expect, it, vi } from "vitest";
import type { Db } from "../db/db.module";
import { profileGroups } from "./profile-groups";

const chain = (value: unknown): unknown =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return Promise.resolve(value).then.bind(Promise.resolve(value));
        return () => chain(value);
      },
    },
  );

describe("profileGroups", () => {
  it("lists nothing to others when the member hides their groups", async () => {
    const select = vi.fn();
    await expect(profileGroups({ select } as unknown as Db, "them", "me", false)).resolves.toEqual(
      [],
    );
    expect(select).not.toHaveBeenCalled();
  });

  it("still shows the member their own, and counts members as numbers", async () => {
    const select = vi
      .fn()
      .mockReturnValue(
        chain([{ slug: "lagos-munch", name: "Lagos Munch", role: "owner", members: "12" }]),
      );
    await expect(profileGroups({ select } as unknown as Db, "me", "me", false)).resolves.toEqual([
      { slug: "lagos-munch", name: "Lagos Munch", role: "owner", members: 12 },
    ]);
  });
});
