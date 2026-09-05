// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { ageGateService } from "./ageGate.service";

describe("AgeGateService", () => {
  beforeEach(() => {
    localStorage.clear();
    ageGateService.reset();
  });

  it("defaults to not confirmed when nothing is in storage", () => {
    expect(ageGateService.isConfirmed()).toBe(false);
  });

  it("marks age as confirmed when confirm() is called", () => {
    ageGateService.confirm();
    expect(ageGateService.isConfirmed()).toBe(true);
  });

  it("resets confirmation status when reset() is called", () => {
    ageGateService.confirm();
    expect(ageGateService.isConfirmed()).toBe(true);

    ageGateService.reset();
    expect(ageGateService.isConfirmed()).toBe(false);
  });

  it("notifies subscribers on confirm/reset and stops after unsubscribe", () => {
    let calls = 0;
    const unsubscribe = ageGateService.subscribe(() => {
      calls += 1;
    });

    ageGateService.confirm();
    ageGateService.reset();
    expect(calls).toBe(2);

    unsubscribe();
    ageGateService.confirm();
    expect(calls).toBe(2);
  });

  it("marks age confirmed even if localStorage throws an error", () => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error("QuotaExceeded or Private Browsing Error");
    };

    try {
      ageGateService.confirm();
      expect(ageGateService.isConfirmed()).toBe(true);
    } finally {
      localStorage.setItem = originalSetItem;
    }
  });
});
