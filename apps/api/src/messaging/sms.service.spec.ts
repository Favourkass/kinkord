import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ConsoleSmsAdapter } from "./console.adapter";
import { type RobaseSmsAdapter } from "./robase.adapter";
import { SmsService } from "./sms.service";

describe("SmsService", () => {
  let robase: { send: ReturnType<typeof vi.fn> };
  let console_: { send: ReturnType<typeof vi.fn> };
  let service: SmsService;
  const nodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    robase = { send: vi.fn().mockResolvedValue({ provider: "robase", providerMessageId: "m1" }) };
    console_ = {
      send: vi.fn().mockResolvedValue({ provider: "console", providerMessageId: "l1" }),
    };
    service = new SmsService(
      robase as unknown as RobaseSmsAdapter,
      console_ as unknown as ConsoleSmsAdapter,
    );
    process.env.ROBASE_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.ROBASE_API_KEY;
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  });

  it("sends through Robase when a key is configured", async () => {
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
    // Termii only carried +234 and everything else threw "not supported yet".
    await expect(service.send({ to: "+14155550100", message: "x" })).resolves.toMatchObject({
      provider: "robase",
    });
  });

  it("prints the message locally when there is no key, so the flow is testable", async () => {
    delete process.env.ROBASE_API_KEY;
    process.env.NODE_ENV = "development";

    const result = await service.send({ to: "+2348012345678", message: "code 123456" });

    expect(console_.send).toHaveBeenCalledWith({ to: "+2348012345678", message: "code 123456" });
    expect(robase.send).not.toHaveBeenCalled();
    expect(result.provider).toBe("console");
  });

  it("refuses to fake a send in production", async () => {
    // Silently printing instead of texting would tell members a code is coming
    // and send nothing.
    delete process.env.ROBASE_API_KEY;
    process.env.NODE_ENV = "production";

    await expect(service.send({ to: "+2348012345678", message: "x" })).rejects.toThrow(
      /ROBASE_API_KEY/,
    );
    expect(console_.send).not.toHaveBeenCalled();
  });
});
