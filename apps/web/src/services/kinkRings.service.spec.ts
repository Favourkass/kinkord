import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
vi.mock("./apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./apiClient")>()),
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
  },
}));

const { giveRingError, kinkRingsApi } = await import("./kinkRings.service");
const { ApiError } = await import("./apiClient");

beforeEach(() => {
  get.mockReset().mockResolvedValue({ available: [], given: [] });
  post.mockReset().mockResolvedValue({});
});

describe("kinkRingsApi", () => {
  it("reads the member's rings", async () => {
    await kinkRingsApi.mine();
    expect(get).toHaveBeenCalledWith("/kink-rings");
  });

  it("gives a ring by username, with or without the @", async () => {
    await kinkRingsApi.give(" @Ada ");
    expect(post).toHaveBeenCalledWith("/kink-rings/give", { username: "Ada" });
  });
});

describe("giveRingError", () => {
  it("passes on what the API said about a refusal", () => {
    expect(
      giveRingError(new ApiError(400, { message: "Ada already has Silver for good." }), "Oops"),
    ).toBe("Ada already has Silver for good.");
    expect(giveRingError(new ApiError(404, { message: "No such member." }), "Oops")).toBe(
      "No such member.",
    );
  });

  it("says the screen's own words for anything else", () => {
    expect(giveRingError(new ApiError(500, { message: "boom" }), "Oops")).toBe("Oops");
    expect(giveRingError(new ApiError(400, { message: ["a", "b"] }), "Oops")).toBe("Oops");
    expect(giveRingError(new Error("offline"), "Oops")).toBe("Oops");
  });
});

it("keeps unused rings and allocates only the reviewed quantity", async () => {
  const { ringGiftAssignments } = await import("./kinkRings.service");
  expect(ringGiftAssignments(["r1", "r2", "r3"], [{ username: "ada", quantity: 2 }])).toEqual([
    { ringId: "r1", username: "ada" },
    { ringId: "r2", username: "ada" },
  ]);
  expect(() => ringGiftAssignments(["r1"], [{ username: "ada", quantity: 2 }])).toThrow();
  expect(() => ringGiftAssignments(["r1", "r1"], [{ username: "ada", quantity: 1 }])).toThrow();
  expect(() => ringGiftAssignments(["r1"], [{ username: "ada", quantity: 0 }])).toThrow();
});
it("posts the exact selected assignments for safe retries", async () => {
  const gifts = [{ ringId: "r1", username: "ada" }];
  await kinkRingsApi.giveSelected(gifts);
  expect(post).toHaveBeenCalledWith("/kink-rings/give-selected", { gifts });
});
