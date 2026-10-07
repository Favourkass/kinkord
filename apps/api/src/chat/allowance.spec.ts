import { describe, expect, it } from "vitest";
import { SILVER_NEW_CHATS_PER_DAY } from "../subscriptions/plans";
import { chatDay, FREE_NEW_CHATS_PER_DAY, newChatsPerDay } from "./allowance";

describe("chatDay", () => {
  it("runs midnight to midnight in Lagos", () => {
    // 10:00 UTC is 11:00 in Lagos: the day began at 23:00 UTC the night before.
    expect(chatDay(new Date("2026-09-30T10:00:00Z"))).toEqual({
      start: new Date("2026-09-29T23:00:00Z"),
      end: new Date("2026-09-30T23:00:00Z"),
    });
  });

  it("rolls over at Lagos midnight, not UTC midnight", () => {
    // 23:30 UTC is already 00:30 the next day in Lagos.
    expect(chatDay(new Date("2026-09-30T23:30:00Z")).start).toEqual(
      new Date("2026-09-30T23:00:00Z"),
    );
    expect(chatDay(new Date("2026-09-30T22:59:59Z")).start).toEqual(
      new Date("2026-09-29T23:00:00Z"),
    );
  });
});

describe("newChatsPerDay", () => {
  it("gives members the free allowance", () => {
    expect(newChatsPerDay({ email: "ada@example.com", emailVerified: true })).toBe(
      FREE_NEW_CHATS_PER_DAY,
    );
    expect(FREE_NEW_CHATS_PER_DAY).toBe(1);
  });

  it("raises the allowance for Silver", () => {
    expect(newChatsPerDay({ email: "ada@example.com", emailVerified: true }, true)).toBe(
      SILVER_NEW_CHATS_PER_DAY,
    );
    expect(SILVER_NEW_CHATS_PER_DAY).toBeGreaterThan(FREE_NEW_CHATS_PER_DAY);
  });

  it("doesn't limit the super admins", () => {
    expect(
      newChatsPerDay({ email: "maxihandsome@gmail.com", emailVerified: true }, true),
    ).toBeNull();
    expect(newChatsPerDay({ email: "maxihandsome@gmail.com", emailVerified: true })).toBeNull();
    expect(newChatsPerDay({ email: "tegamaxwell2026@gmail.com", emailVerified: true })).toBeNull();
    expect(newChatsPerDay({ email: " NnabueKassidy@gmail.com", emailVerified: true })).toBeNull();
  });

  it("limits an admin address nobody has verified", () => {
    expect(newChatsPerDay({ email: "maxihandsome@gmail.com", emailVerified: false })).toBe(1);
  });
});
