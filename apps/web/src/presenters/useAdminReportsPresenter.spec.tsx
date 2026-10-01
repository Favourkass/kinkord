// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AdminReportPM } from "@/domain/moderation";
import { useAdminReportsPresenter } from "./useAdminReportsPresenter";

const access = vi.fn();
const reports = vi.fn();
const resolveReport = vi.fn();
vi.mock("@/services/moderation.service", () => ({
  moderationService: {
    access: () => access(),
    reports: (...a: unknown[]) => reports(...a),
    resolveReport: (...a: unknown[]) => resolveReport(...a),
  },
}));

const report = (id: string, over: Partial<AdminReportPM> = {}): AdminReportPM => ({
  id,
  reason: "harassment",
  details: null,
  status: "open",
  createdAt: "2026-10-01T12:00:00Z",
  reviewedAt: null,
  reportedUserId: "u2",
  reporter: { userId: "u1", username: "favour", displayName: "Favour" },
  reported: { userId: "u2", username: "ada", displayName: "Ada" },
  evidence: [],
  ...over,
});

describe("useAdminReportsPresenter", () => {
  beforeEach(() => {
    access.mockReset().mockResolvedValue({ isAdmin: true });
    reports.mockReset().mockResolvedValue([report("r1", { reason: "underage" }), report("r2")]);
    resolveReport.mockReset().mockResolvedValue({ id: "r1", status: "resolved" });
  });
  afterEach(cleanup);

  it("loads the open reports for an admin, linking each to the member", async () => {
    const { result } = renderHook(() => useAdminReportsPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(reports).toHaveBeenCalledWith("open");
    expect(result.current.rows[0]).toMatchObject({
      urgent: true,
      reportedHref: "/moderation/members/u2",
    });
    expect(result.current.statuses.find((s) => s.active)?.value).toBe("open");
  });

  it("asks for nothing when the member isn't an admin", async () => {
    access.mockResolvedValue({ isAdmin: false });
    const { result } = renderHook(() => useAdminReportsPresenter());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(reports).not.toHaveBeenCalled();
  });

  it("shows the reports for the status picked", async () => {
    const { result } = renderHook(() => useAdminReportsPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    reports.mockResolvedValueOnce([]);
    act(() => result.current.setStatus("dismissed"));
    await waitFor(() => expect(result.current.empty).toBe(true));
    expect(reports).toHaveBeenLastCalledWith("dismissed");
  });

  it("takes a report off the list once it's resolved or dismissed", async () => {
    const { result } = renderHook(() => useAdminReportsPresenter());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.resolve("r1"));
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(["r2"]));
    expect(resolveReport).toHaveBeenCalledWith("r1", "resolved");
    act(() => result.current.dismiss("r2"));
    await waitFor(() => expect(result.current.empty).toBe(true));
    expect(resolveReport).toHaveBeenLastCalledWith("r2", "dismissed");
  });
});
