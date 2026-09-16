import { describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { ConsoleSmsAdapter } from "./console.adapter";

describe("ConsoleSmsAdapter", () => {
  it("prints the message so a local run can read the code out of the API log", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const adapter = new ConsoleSmsAdapter();

    const result = await adapter.send({
      to: "+2348012345678",
      message: "Your Kinkord verification code is 428391. It expires in 10 minutes.",
    });

    const printed = String(log.mock.calls[0][0]);
    expect(printed).toContain("+2348012345678");
    // The code has to be readable, or the whole point is lost.
    expect(printed).toContain("428391");
    expect(result.provider).toBe("console");
    expect(result.providerMessageId).toMatch(/^local-\d+$/);
    log.mockRestore();
  });

  it("names itself something no one could mistake for a delivered message", () => {
    // Shows up in logs and in any future provider column; "console" is a
    // deliberate tell that nothing left the building.
    expect(new ConsoleSmsAdapter().providerName).toBe("console");
  });
});
