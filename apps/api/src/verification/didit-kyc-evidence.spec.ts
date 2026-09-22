import { describe, expect, it } from "vitest";
import { deriveDiditNetworkLocationEvidence, deriveDiditResidenceEvidence } from "./didit-kyc-evidence";

describe("Didit KYC evidence mapping", () => {
  it("keeps only derived residence outcomes and approves a clean PoA result", () => {
    const result = deriveDiditResidenceEvidence({ poa: {
      status: "Approved", poa_formatted_address: "sensitive address", issue_date: "2026-09-01", warnings: [],
    } });
    expect(result).toEqual({
      status: "passed",
      summary: { documentApproved: true, addressExtracted: true, issueDateExtracted: true, issueDateWithinPolicy: true, noIdentityMismatch: true },
      reasonCodes: [],
    });
    expect(JSON.stringify(result)).not.toContain("sensitive address");
  });

  it("routes an approved but stale proof-of-address document to review", () => {
    const result = deriveDiditResidenceEvidence({ poa: {
      status: "Approved", poa_address: "sensitive", issue_date: "2025-01-01", warnings: [],
    } }, new Date("2026-09-22T00:00:00Z"));
    expect(result.status).toBe("under_review");
    expect(result.summary.issueDateWithinPolicy).toBe(false);
    expect(result.reasonCodes).toContain("POA_DOCUMENT_TOO_OLD");
  });

  it("routes a PoA name mismatch to review", () => {
    const result = deriveDiditResidenceEvidence({ poa: {
      status: "Approved", poa_address: "sensitive", issue_date: "2026-09-01", warnings: [{ risk: "NAME_MISMATCH_ID_VERIFICATION" }],
    } });
    expect(result.status).toBe("under_review");
    expect(result.reasonCodes).toEqual(["NAME_MISMATCH_ID_VERIFICATION"]);
  });

  it("never treats approved IP analysis as GPS verification", () => {
    const result = deriveDiditNetworkLocationEvidence({ ip_analyses: [{
      status: "Approved", ip_country_code: "NG", is_vpn_or_tor: false, is_data_center: false, latitude: 1.2, longitude: 3.4, warnings: [],
    }] }, "NG");
    expect(result.status).toBe("under_review");
    expect(result.reasonCodes).toEqual(["GPS_LOCATION_REQUIRED"]);
    expect(JSON.stringify(result)).not.toContain("1.2");
  });
});
