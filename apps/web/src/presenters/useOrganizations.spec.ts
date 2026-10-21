// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/services/apiClient", () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

afterEach(cleanup);

describe("useOrganizations", () => {
  it("reads the organizations on first use and re-renders once they're in", async () => {
    get.mockResolvedValue({
      items: [{ userId: "o1", username: "ng", displayName: "NG", country: "NG" }],
    });
    const { useOrganizations } = await import("./useOrganizations");
    const { result } = renderHook(() => useOrganizations());
    expect(result.current.size).toBe(0);
    await waitFor(() => expect(result.current.has("o1")).toBe(true));
    // A second screen shares what the first one read.
    const other = renderHook(() => useOrganizations());
    expect(other.result.current.has("o1")).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
