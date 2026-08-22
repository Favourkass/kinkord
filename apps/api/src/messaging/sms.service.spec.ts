import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmsService } from "./sms.service";
import { type TermiiSmsAdapter } from "./termii.adapter";

describe("SmsService", () => {
  let termii: { send: ReturnType<typeof vi.fn> };
  let service: SmsService;

  beforeEach(() => {
    termii = { send: vi.fn().mockResolvedValue({ provider: "termii", providerMessageId: "m1" }) };
    service = new SmsService(termii as unknown as TermiiSmsAdapter);
  });

  it("routes Nigerian numbers (+234) through Termii", async () => {
    const result = await service.send({ to: "+2348012345678", message: "hello" });
    expect(termii.send).toHaveBeenCalledWith({ to: "+2348012345678", message: "hello" });
    expect(result).toEqual({ provider: "termii", providerMessageId: "m1" });
  });

  it("trims whitespace before routing", async () => {
    await service.send({ to: "  +2348012345678  ", message: "hi" });
    expect(termii.send).toHaveBeenCalledWith({ to: "+2348012345678", message: "hi" });
  });

  it("rejects non-E.164 destinations", async () => {
    await expect(service.send({ to: "08012345678", message: "x" })).rejects.toThrow(/E\.164/);
    expect(termii.send).not.toHaveBeenCalled();
  });

  it("fails loudly for corridors without a configured provider", async () => {
    await expect(service.send({ to: "+14155550100", message: "x" })).rejects.toThrow(
      /not supported yet/,
    );
    expect(termii.send).not.toHaveBeenCalled();
  });
});
