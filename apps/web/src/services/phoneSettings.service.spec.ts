import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveSettingsPhone } from "./phoneSettings.service";
const update = vi.hoisted(() => vi.fn());
vi.mock("./profile.service", () => ({ profileApi: { update } }));
describe("saveSettingsPhone", () => {
  beforeEach(() => {
    update.mockReset().mockResolvedValue({ phone: "+2348031234567" });
  });
  it.each(["0803 123 4567", "+234 803 123 4567"])("normalizes %s", async (value) => {
    await saveSettingsPhone(value);
    expect(update).toHaveBeenCalledWith({ phone: "+2348031234567" });
  });
  it.each(["", "12", "+447700900123"])("rejects invalid numbers %s", (value) => {
    expect(() => saveSettingsPhone(value)).toThrow(/Nigerian mobile/);
    expect(update).not.toHaveBeenCalled();
  });
  it("propagates save failures", async () => {
    update.mockRejectedValue(new Error("Number already in use"));
    await expect(saveSettingsPhone("08031234567")).rejects.toThrow("Number already in use");
  });
});
