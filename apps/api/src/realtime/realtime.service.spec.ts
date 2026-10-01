import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Static credentials so signing never looks for a real AWS profile.
vi.mock("@aws-sdk/credential-provider-node", () => ({
  defaultProvider: () => async () => ({ accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" }),
}));

// The kinkord/realtime secret, as the stack writes it.
const send = vi.fn();
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = send;
  },
  GetSecretValueCommand: class {
    constructor(readonly input: unknown) {}
  },
}));

const SETTINGS = {
  httpDomain: "abc.appsync-api.eu-west-1.amazonaws.com",
  wsDomain: "abc.appsync-realtime-api.eu-west-1.amazonaws.com",
  key: "test-key",
};

async function makeService(secretId: string | null = "kinkord/realtime") {
  if (secretId) process.env.REALTIME_SECRET_ID = secretId;
  else delete process.env.REALTIME_SECRET_ID;
  const { RealtimeService } = await import("./realtime.service");
  return new RealtimeService();
}

describe("RealtimeService", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ SecretString: JSON.stringify(SETTINGS) });
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete process.env.REALTIME_SECRET_ID;
  });

  it("stays off without touching AWS outside production unless told which secret", async () => {
    const service = await makeService(null);
    await expect(service.connectionFor("u1")).resolves.toEqual({ enabled: false });
    await service.notify(["u1"], { type: "message", conversationId: "c1" });
    expect(send).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hands a member their channel, the endpoints and a ten-minute token", async () => {
    const service = await makeService();
    const conn = await service.connectionFor("u1", new Date("2026-10-01T12:00:00Z"));
    expect(conn).toMatchObject({
      enabled: true,
      url: "wss://abc.appsync-realtime-api.eu-west-1.amazonaws.com/event/realtime",
      host: "abc.appsync-api.eu-west-1.amazonaws.com",
      channel: "/chat/u1",
      expiresAt: "2026-10-01T12:10:00.000Z",
    });
    expect(conn.enabled && conn.token).toMatch(/^v1\./);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ input: { SecretId: "kinkord/realtime" } });
  });

  it("reads the secret once and reuses it", async () => {
    const service = await makeService();
    await service.connectionFor("u1");
    await service.connectionFor("u2");
    await service.notify(["u1"], { type: "message", conversationId: "c1" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stays off while the secret is missing, and tries again five minutes on", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    send.mockRejectedValueOnce(new Error("ResourceNotFoundException"));
    const service = await makeService();
    await expect(service.connectionFor("u1")).resolves.toEqual({ enabled: false });
    await expect(service.connectionFor("u1")).resolves.toEqual({ enabled: false });
    expect(send).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-10-01T12:05:01Z"));
    await expect(service.connectionFor("u1")).resolves.toMatchObject({ enabled: true });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("leaves an id AppSync can't name on polling", async () => {
    const service = await makeService();
    await expect(service.connectionFor("bad_id")).resolves.toEqual({ enabled: false });
  });

  it("publishes a signed event to each member's channel, once each", async () => {
    const service = await makeService();
    await service.notify(["u2", "u1", "u2"], { type: "message", conversationId: "c1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://abc.appsync-api.eu-west-1.amazonaws.com/event");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      channel: "/chat/u2",
      events: [JSON.stringify({ type: "message", conversationId: "c1" })],
    });
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/eu-west-1\/appsync\/aws4_request/,
    );
    expect(headers.authorization).toMatch(/SignedHeaders=[a-z0-9;-]*host;[a-z0-9;-]*x-amz-date/);
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("host");
  });

  it("never throws: a failed publish is logged and the send carries on", async () => {
    const service = await makeService();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockRejectedValueOnce(new Error("x"));
    await expect(
      service.notify(["u1", "u2"], { type: "message", conversationId: "c1" }),
    ).resolves.toBeUndefined();
  });
});
