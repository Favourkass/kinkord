import type { KycStageStatus } from "../db/schema";

export interface DiditDerivedStageEvidence {
  status: KycStageStatus;
  /** Strictly allow-listed outcomes; never include an address, coordinate, IP or document URL. */
  summary: Record<string, boolean | string>;
  reasonCodes: string[];
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const warnings = (value: unknown) => Array.isArray(value)
  ? value.map(record).filter((item): item is Record<string, unknown> => Boolean(item))
  : [];

function statusFromDidit(status: unknown): KycStageStatus {
  if (status === "Approved") return "passed";
  if (status === "Declined") return "failed";
  if (status === "In Review" || status === "Resub Requested") return "under_review";
  if (status === "Not Finished") return "pending";
  return "under_review";
}

/** Approved proof-of-address documents must be recently issued (default 90 days). */
export const KYC_POA_MAX_AGE_DAYS = (() => {
  const configured = Number(process.env.KYC_POA_MAX_AGE_DAYS ?? "90");
  return Number.isFinite(configured) && configured >= 7 && configured <= 365 ? configured : 90;
})();

function poaIssueDateState(issueDate: string, now: Date): "fresh" | "stale" | "invalid" {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return "invalid";
  const issued = new Date(`${issueDate}T00:00:00Z`);
  if (Number.isNaN(issued.getTime())) return "invalid";
  const ageDays = (now.getTime() - issued.getTime()) / 86_400_000;
  if (ageDays < -1) return "invalid";
  return ageDays <= KYC_POA_MAX_AGE_DAYS ? "fresh" : "stale";
}

/**
 * Maps Didit's PoA report without retaining the address, document URL, issuer
 * or extracted identity data. An approved report with any risk is review-only.
 */
export function deriveDiditResidenceEvidence(decision: Record<string, unknown>, now = new Date()): DiditDerivedStageEvidence {
  const poa = record(decision.poa);
  if (!poa) return { status: "pending", summary: {}, reasonCodes: ["POA_RESULT_PENDING"] };
  const riskCodes = warnings(poa.warnings).map((warning) => String(warning.risk ?? "POA_WARNING"));
  const providerStatus = statusFromDidit(poa.status);
  const hasAddress = typeof poa.poa_formatted_address === "string" || typeof poa.poa_address === "string";
  const issueDateState = poaIssueDateState(String(poa.issue_date ?? ""), now);
  const hasCurrentIssueDate = issueDateState === "fresh";
  const identityMismatch = riskCodes.some((code) => /^NAME_MISMATCH/.test(code));
  const summary = {
    documentApproved: providerStatus === "passed",
    addressExtracted: hasAddress,
    issueDateExtracted: issueDateState !== "invalid",
    issueDateWithinPolicy: hasCurrentIssueDate,
    noIdentityMismatch: !identityMismatch,
  };
  if (providerStatus !== "passed") return { status: providerStatus, summary, reasonCodes: riskCodes };
  if (issueDateState === "stale" && !riskCodes.includes("POA_DOCUMENT_TOO_OLD")) riskCodes.push("POA_DOCUMENT_TOO_OLD");
  else if (issueDateState === "invalid" && !riskCodes.includes("POA_ISSUE_DATE_INVALID")) riskCodes.push("POA_ISSUE_DATE_INVALID");
  if (!hasAddress || issueDateState !== "fresh" || identityMismatch || riskCodes.length) {
    return { status: "under_review", summary, reasonCodes: riskCodes.length ? riskCodes : ["POA_REVIEW_REQUIRED"] };
  }
  return { status: "passed", summary, reasonCodes: [] };
}

/**
 * Didit Device & IP Analysis is useful anti-fraud evidence, but an IP-derived
 * location is not GPS. It can fail or escalate a KYC case; it cannot pass the
 * Kinkord live-location safeguard without separately consented GPS evidence.
 */
export function deriveDiditNetworkLocationEvidence(decision: Record<string, unknown>, expectedCountryCode: string): DiditDerivedStageEvidence {
  const analyses = Array.isArray(decision.ip_analyses) ? decision.ip_analyses.map(record)
    .filter((item): item is Record<string, unknown> => Boolean(item)) : [];
  if (!analyses.length) return { status: "pending", summary: {}, reasonCodes: ["IP_ANALYSIS_PENDING"] };
  const latest = analyses[analyses.length - 1];
  const providerStatus = statusFromDidit(latest.status);
  const countryMatches = String(latest.ip_country_code ?? "").toUpperCase() === expectedCountryCode.toUpperCase();
  const privateNetwork = latest.is_vpn_or_tor === true || latest.is_data_center === true;
  const summary = { providerApproved: providerStatus === "passed", countryMatches, privateNetwork: !privateNetwork };
  const riskCodes = warnings(latest.warnings).map((warning) => String(warning.risk ?? "IP_ANALYSIS_WARNING"));
  if (providerStatus === "failed") return { status: "failed", summary, reasonCodes: riskCodes.length ? riskCodes : ["IP_ANALYSIS_DECLINED"] };
  if (providerStatus !== "passed" || privateNetwork || !countryMatches) {
    return { status: "under_review", summary, reasonCodes: riskCodes.length ? riskCodes : ["NETWORK_LOCATION_REQUIRES_REVIEW"] };
  }
  return { status: "under_review", summary, reasonCodes: ["GPS_LOCATION_REQUIRED"] };
}

/** Coordinates are intentionally returned only for in-memory distance comparison. */
export function diditProofOfAddressCoordinate(decision: Record<string, unknown>) {
  const poa = record(decision.poa);
  const parsed = record(poa?.poa_parsed_address);
  const rawResults = record(parsed?.raw_results);
  const geometry = record(rawResults?.geometry);
  const location = record(geometry?.location);
  const latitude = Number(location?.lat);
  const longitude = Number(location?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}
