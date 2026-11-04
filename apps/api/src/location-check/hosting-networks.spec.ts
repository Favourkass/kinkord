import { describe, expect, it } from "vitest";
import { isHostingNetwork } from "./hosting-networks";

describe("isHostingNetwork", () => {
  it("knows the clouds and the networks VPNs rent", () => {
    expect(isHostingNetwork(16509, "Amazon.com, Inc.")).toBe(true);
    expect(isHostingNetwork(9009, "M247 Europe SRL")).toBe(true);
    expect(isHostingNetwork(14061, "DigitalOcean, LLC")).toBe(true);
  });

  it("only trusts a number when the owner's name agrees", () => {
    expect(isHostingNetwork(9009, "Some Mobile Operator Ltd")).toBe(false);
  });

  it("recognises hosting by the owner's name", () => {
    expect(isHostingNetwork(64512, "Example VPS Hosting LLC")).toBe(true);
    expect(isHostingNetwork(null, "Acme Data Center Services")).toBe(true);
  });

  it("leaves home, mobile and location-keeping relay networks alone", () => {
    expect(isHostingNetwork(29465, "MTN NIGERIA Communication limited")).toBe(false);
    expect(isHostingNetwork(33771, "Safaricom Limited")).toBe(false);
    expect(isHostingNetwork(13335, "Cloudflare, Inc.")).toBe(false);
    expect(isHostingNetwork(36183, "Akamai Technologies, Inc.")).toBe(false);
  });

  it("says nothing without an owner", () => {
    expect(isHostingNetwork(16509, null)).toBe(false);
  });
});
