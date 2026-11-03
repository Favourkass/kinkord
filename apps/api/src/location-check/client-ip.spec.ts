import { afterEach, describe, expect, it, vi } from "vitest";
import { checkedIp } from "./client-ip";

const fromAws = new Headers({ "x-forwarded-for": "6.6.6.6, 102.89.32.1" });

describe("checkedIp", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the address that reached AWS, never one written into the header", () => {
    expect(checkedIp(fromAws)).toBe("102.89.32.1");
  });

  it("lets a development machine pretend to be elsewhere", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCATION_CHECK_DEV_IP", "41.90.64.1");
    expect(checkedIp(fromAws)).toBe("41.90.64.1");
  });

  it("ignores the pretend address in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCATION_CHECK_DEV_IP", "41.90.64.1");
    expect(checkedIp(fromAws)).toBe("102.89.32.1");
  });
});
