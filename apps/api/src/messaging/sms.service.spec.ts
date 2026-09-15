import { beforeEach, describe, expect, it, vi } from "vitest";
import { type RobaseSmsAdapter } from "./robase.adapter";
import { SmsService } from "./sms.service";

describe("SmsService", () => {
  let robase: { send: ReturnType<typeof vi.fn> };
  let service: SmsService;

  beforeEach(() => {
    robase = { send: vi.fn().mockResolvedValue({ provider: "robase", providerMessageId: "m1" }) };
    service = new SmsService(robase as unknown as RobaseSmsAdapter);
  });

  it("sends through Robase", async () => {
    const result = await service.send({ to: "+2348012345678", message: "hello" });
    expect(robase.send).toHaveBeenCalledWith({ to: "+2348012345678", message: "hello" });
    expect(result).toEqual({ provider: "robase", providerMessageId: "m1" });
  });

  it("trims whitespace before sending", async () => {
    await service.send({ to: "  +2348012345678  ", message: "hi" });
    expect(robase.send).toHaveBeenCalledWith({ to: "+2348012345678", message: "hi" });
  });

  it("rejects non-E.164 destinations", async () => {
    await expect(service.send({ to: "08012345678", message: "x" })).rejects.toThrow(/E\.164/);
    expect(robase.send).not.toHaveBeenCalled();
  });

  it("no longer dead-ends international numbers", async () => {
    // Termii only carried +234 and everything else threw "not supported yet";
    // Robase routes per country, so a US number is simply handed over.
    await expect(service.send({ to: "+14155550100", message: "x" })).resolves.toMatchObject({
      provider: "robase",
    });
    expect(robase.send).toHaveBeenCalledWith({ to: "+14155550100", message: "x" });
  });
});
