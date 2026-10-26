import { describe, expect, it, vi } from "vitest";
import { SEEN_BATCH_MAX, createSeenBatcher } from "./seenBatcher";

describe("createSeenBatcher", () => {
  it("reports each post once per visit, when flushed", () => {
    const send = vi.fn(async () => undefined);
    const batcher = createSeenBatcher(send);
    batcher.add("a");
    batcher.add("b");
    batcher.add("a");
    expect(send).not.toHaveBeenCalled();
    batcher.flush();
    expect(send).toHaveBeenCalledWith(["a", "b"]);
    // Shown again on the same visit: not reported again.
    batcher.add("a");
    batcher.flush();
    expect(send).toHaveBeenCalledOnce();
  });

  it("reports at once when a batch is full, never more than the API takes", () => {
    const send = vi.fn(async () => undefined);
    const batcher = createSeenBatcher(send);
    const ids = Array.from({ length: SEEN_BATCH_MAX }, (_, i) => `p${i}`);
    ids.forEach((id) => batcher.add(id));
    expect(send).toHaveBeenCalledWith(ids);
    expect(SEEN_BATCH_MAX).toBe(50);
  });

  it("sends nothing when nothing is waiting, and shrugs off a failed report", async () => {
    const send = vi.fn(async () => {
      throw new Error("offline");
    });
    const batcher = createSeenBatcher(send);
    batcher.flush();
    expect(send).not.toHaveBeenCalled();
    batcher.add("a");
    expect(() => batcher.flush()).not.toThrow();
    await Promise.resolve();
    expect(send).toHaveBeenCalledOnce();
  });
});
