import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RobaseSmsAdapter } from "./robase.adapter";

const ok = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("RobaseSmsAdapter", () => {
  let adapter: RobaseSmsAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.ROBASE_API_KEY = "test-key";
    delete process.env.ROBASE_BASE_URL;
    adapter = new RobaseSmsAdapter();
    fetchMock = vi.fn(async () => ok({ id: "sms_1", status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ROBASE_API_KEY;
  });

  it("posts the message to the documented endpoint with a bearer token", async () => {
    const result = await adapter.send({ to: "+2348012345678", message: "Your code is 123456" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.robase.dev/v1/sms/send");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    expect(JSON.parse(String(init.body))).toEqual({
      phone_number: "+2348012345678",
      message: "Your code is 123456",
    });
    expect(result).toEqual({ provider: "robase", providerMessageId: "sms_1" });
  });

  it("sends an idempotency key so a retry cannot double-text a member", async () => {
    await adapter.send({ to: "+2348012345678", message: "one" });
    await adapter.send({ to: "+2348012345678", message: "two" });

    const keys = fetchMock.mock.calls.map(
      ([, init]) => (init as RequestInit).headers as Record<string, string>,
    );
    expect(keys[0]["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]["idempotency-key"]).not.toBe(keys[0]["idempotency-key"]);
  });

  it("refuses to run without an API key rather than failing at the provider", async () => {
    delete process.env.ROBASE_API_KEY;
    await expect(adapter.send({ to: "+2348012345678", message: "x" })).rejects.toThrow(
      /ROBASE_API_KEY/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the provider rejects the send", async () => {
    fetchMock.mockResolvedValueOnce(ok({ error: "insufficient_balance" }, 402));
    await expect(adapter.send({ to: "+2348012345678", message: "x" })).rejects.toThrow(
      /Robase \(402\)/,
    );
  });

  it("treats a 200 with no id as a failure, not a delivery", async () => {
    fetchMock.mockResolvedValueOnce(ok({ status: "rejected" }));
    await expect(adapter.send({ to: "+2348012345678", message: "x" })).rejects.toThrow(/Robase/);
  });

  it("honours a base URL override for staging", async () => {
    process.env.ROBASE_BASE_URL = "https://sandbox.robase.dev/";
    await adapter.send({ to: "+2348012345678", message: "x" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://sandbox.robase.dev/v1/sms/send");
  });
});
