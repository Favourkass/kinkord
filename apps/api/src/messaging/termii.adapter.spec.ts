import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TermiiSmsAdapter } from "./termii.adapter";

describe("TermiiSmsAdapter", () => {
  const fetchMock = vi.fn();
  const env = { ...process.env };

  beforeEach(() => {
    process.env.TERMII_API_KEY = "test_key";
    process.env.TERMII_SENDER_ID = "KINKORD";
    process.env.TERMII_CHANNEL = "generic";
    process.env.TERMII_BASE_URL = "https://v4.api.termii.com/";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message_id: "msg_123" }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...env };
  });

  it("sends the correct payload to the Termii send endpoint", async () => {
    const adapter = new TermiiSmsAdapter();
    const result = await adapter.send({ to: "+2348012345678", message: "Your code is 483920." });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://v4.api.termii.com/api/sms/send");
    expect(JSON.parse(init.body)).toEqual({
      api_key: "test_key",
      to: "2348012345678",
      from: "KINKORD",
      sms: "Your code is 483920.",
      type: "plain",
      channel: "generic",
    });
    expect(result).toEqual({ provider: "termii", providerMessageId: "msg_123" });
  });

  it("uses the DND channel when configured", async () => {
    process.env.TERMII_CHANNEL = "dnd";
    await new TermiiSmsAdapter().send({ to: "+2348012345678", message: "x" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).channel).toBe("dnd");
  });

  it("throws when the API key is missing", async () => {
    delete process.env.TERMII_API_KEY;
    await expect(new TermiiSmsAdapter().send({ to: "+234801", message: "x" })).rejects.toThrow(
      /TERMII_API_KEY/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on a failed provider response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "invalid key" }),
    });
    await expect(
      new TermiiSmsAdapter().send({ to: "+2348012345678", message: "x" }),
    ).rejects.toThrow(/Termii \(401\)/);
  });
});
