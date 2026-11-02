// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { LocationCheckRowPM, LocationCheckSummaryPM } from "@/domain/locationCheck";
import { toLocationCheckRowVM, useLocationChecksPresenter } from "./useLocationChecksPresenter";

let access = { checking: false, isAdmin: true, isFounder: true };
vi.mock("./useAdminAccessPresenter", () => ({ useAdminAccessPresenter: () => access }));

const service = { summary: vi.fn(), list: vi.fn(), setMode: vi.fn() };
vi.mock("@/services/locationCheck.service", () => ({
  locationCheckService: {
    summary: (...a: unknown[]) => service.summary(...a),
    list: (...a: unknown[]) => service.list(...a),
    setMode: (...a: unknown[]) => service.setMode(...a),
  },
}));

const summary: LocationCheckSummaryPM = {
  mode: "watch",
  days: 7,
  checks: 12,
  counts: [
    { purpose: "signup", decision: "approved", count: 8 },
    { purpose: "recheck", decision: "mismatch", count: 3 },
    { purpose: "recheck", decision: "skipped", count: 1 },
  ],
  topReasons: [
    { reason: "gps_match", count: 8 },
    { reason: "hosting", count: 2 },
  ],
  people: 10,
  peopleStopped: 4,
  data: {
    countryDataBuiltAt: "2026-11-01T02:47:39.000Z",
    networkDataBuiltAt: "2026-11-01T02:52:43.000Z",
    torExits: 1200,
    torUpdatedAt: "2026-11-02T11:00:00.000Z",
  },
};

const row = (change: Partial<LocationCheckRowPM> = {}): LocationCheckRowPM => ({
  id: "check-1",
  createdAt: "2026-11-02T10:15:00.000Z",
  purpose: "recheck",
  userId: "u1",
  username: "tega",
  displayName: "Tega",
  selectedCountry: "NG",
  gpsStatus: "ok",
  gpsCountry: "GB",
  gpsAccuracyM: 4200,
  ipCountry: "US",
  ipNetwork: "M247 Europe SRL",
  ipAnonymizer: "hosting",
  timezone: "Europe/London",
  reasons: ["elsewhere", "hosting"],
  decision: "mismatch",
  enforced: false,
  ...change,
});

describe("toLocationCheckRowVM", () => {
  it("reads a check in words, with no coordinates", () => {
    expect(toLocationCheckRowVM(row())).toMatchObject({
      title: "@tega · Recheck",
      chose: "Nigeria",
      gps: "United Kingdom · 4.2 km",
      connection: "USA · M247 Europe SRL",
      anonymizer: "VPN / hosting",
      decision: "Mismatch",
      stopped: true,
      watching: "watching",
      reasons: ["GPS and connection elsewhere", "VPN or hosting network"],
    });
  });

  it("shows someone joining, and why there was no GPS", () => {
    expect(
      toLocationCheckRowVM(
        row({
          username: null,
          purpose: "signup",
          gpsStatus: "denied",
          decision: "approved",
          enforced: true,
        }),
      ),
    ).toMatchObject({
      title: "Joining",
      gps: "Location permission refused",
      stopped: false,
      watching: null,
    });
  });
});

describe("useLocationChecksPresenter", () => {
  beforeEach(() => {
    access = { checking: false, isAdmin: true, isFounder: true };
    service.summary.mockReset().mockResolvedValue(summary);
    service.list.mockReset().mockResolvedValue([row()]);
    service.setMode.mockReset().mockResolvedValue({ mode: "enforce" });
  });

  it("shows the week in numbers, with who would have been stopped", async () => {
    const { result } = renderHook(() => useLocationChecksPresenter());
    await waitFor(() => expect(result.current.view.stats).toHaveLength(3));
    expect(result.current.view.stats.map((s) => s.value)).toEqual(["12", "10", "4 (40%)"]);
    expect(result.current.view.stats[2].label).toBe("Would be stopped");
    expect(result.current.view.decisions).toEqual([
      { label: "Approved", count: 8 },
      { label: "Mismatch", count: 3 },
      { label: "Skipped", count: 1 },
    ]);
    expect(result.current.view.reasons[1]).toEqual({ label: "VPN or hosting network", count: 2 });
    expect(result.current.view.data).toHaveLength(3);
    await waitFor(() => expect(result.current.view.list.rows).toHaveLength(1));
  });

  it("lets a founder switch modes, after confirming", async () => {
    const { result } = renderHook(() => useLocationChecksPresenter());
    await waitFor(() => expect(result.current.view.mode.current?.label).toBe("Watch"));
    expect(result.current.view.mode.options.map((o) => o.label)).toEqual([
      "Switch to Off",
      "Switch to Enforce",
    ]);
    act(() => result.current.view.mode.options[1].onSelect());
    expect(result.current.view.mode.pending?.text).toMatch(/Switch the country check to Enforce\?/);
    await act(async () => result.current.view.mode.pending?.confirm());
    await waitFor(() => expect(result.current.view.mode.current?.label).toBe("Enforce"));
    expect(service.setMode).toHaveBeenCalledWith("enforce");
    expect(result.current.view.mode.pending).toBeNull();
  });

  it("shows other admins the mode, but not the switch", async () => {
    access = { checking: false, isAdmin: true, isFounder: false };
    const { result } = renderHook(() => useLocationChecksPresenter());
    await waitFor(() => expect(result.current.view.mode.current).not.toBeNull());
    expect(result.current.view.mode.options).toEqual([]);
    expect(result.current.view.mode.founderOnly).toBe(
      "Only the founders can switch the country check.",
    );
  });

  it("filters by decision, and pages on", async () => {
    service.list.mockResolvedValue(Array.from({ length: 50 }, (_, i) => row({ id: `c${i}` })));
    const { result } = renderHook(() => useLocationChecksPresenter());
    await waitFor(() => expect(result.current.view.list.loadMore).not.toBeNull());
    await act(async () => result.current.view.list.loadMore?.onClick());
    expect(service.list).toHaveBeenLastCalledWith({
      before: "2026-11-02T10:15:00.000Z",
      decision: null,
    });
    act(() => result.current.view.list.filter.onChange("refused"));
    expect(result.current.view.list.loading).toBe(true);
    await waitFor(() => expect(service.list).toHaveBeenLastCalledWith({ decision: "refused" }));
  });

  it("loads nothing for someone who isn't an admin", () => {
    access = { checking: false, isAdmin: false, isFounder: false };
    renderHook(() => useLocationChecksPresenter());
    expect(service.summary).not.toHaveBeenCalled();
    expect(service.list).not.toHaveBeenCalled();
  });
});
