// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { BlockRulePM } from "@/domain/moderation";
import { useBlocklistPresenter } from "./useBlocklistPresenter";

const svc = { access: vi.fn(), rules: vi.fn(), addRule: vi.fn(), removeRule: vi.fn() };
vi.mock("@/services/moderation.service", () => ({
  moderationService: new Proxy(
    {},
    {
      get:
        (_t, name: string) =>
        (...a: unknown[]) =>
          svc[name as keyof typeof svc](...a),
    },
  ),
}));

const rule = (id: string, over: Partial<BlockRulePM> = {}): BlockRulePM => ({
  id,
  kind: "email",
  value: "ctolulope05@gmail.com",
  action: "block",
  reason: null,
  subjectUserId: null,
  createdAt: "2026-09-28T08:00:00Z",
  ...over,
});

describe("useBlocklistPresenter", () => {
  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    svc.access.mockResolvedValue({ isAdmin: true });
    svc.rules.mockResolvedValue([rule("r1")]);
    svc.removeRule.mockResolvedValue({ removed: "r1" });
  });
  afterEach(cleanup);

  it("loads the list", async () => {
    const { result } = renderHook(() => useBlocklistPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0].action).toBe("Blocked");
  });

  it("defaults IPs and names to flag, emails and phones to block", async () => {
    const { result } = renderHook(() => useBlocklistPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.form.setKind("ip"));
    expect(result.current.form.action).toBe("flag");
    act(() => result.current.form.setKind("phone"));
    expect(result.current.form.action).toBe("block");
  });

  it("refuses a value that doesn't fit, without calling the server", async () => {
    const { result } = renderHook(() => useBlocklistPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.form.setValue("not-an-email"));
    await act(async () => result.current.form.submit());
    expect(result.current.form.error).toMatch(/email/);
    expect(svc.addRule).not.toHaveBeenCalled();
  });

  it("adds a rule to the top and clears the field", async () => {
    svc.addRule.mockResolvedValue(rule("r2", { kind: "name", value: "durowara", action: "flag" }));
    const { result } = renderHook(() => useBlocklistPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.form.setKind("name"));
    act(() => result.current.form.setValue(" Durowara "));
    await act(async () => result.current.form.submit());
    expect(svc.addRule).toHaveBeenCalledWith({
      kind: "name",
      value: "Durowara",
      action: "flag",
      reason: null,
    });
    expect(result.current.rows.map((r) => r.id)).toEqual(["r2", "r1"]);
    expect(result.current.form.value).toBe("");
  });

  it("removes a rule", async () => {
    const { result } = renderHook(() => useBlocklistPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    await act(async () => result.current.remove("r1"));
    await waitFor(() => expect(result.current.rows).toHaveLength(0));
    expect(result.current.empty).toBe(true);
  });
});
