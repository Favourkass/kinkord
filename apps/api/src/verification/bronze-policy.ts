export const BRONZE_POLICY_VERSION = "bronze-2026-09-16";
export const BRONZE_MAX_ATTEMPTS = 3;

export interface BronzeChecks {
  governmentId: boolean;
  liveness: boolean;
  idFace: boolean;
  profileFace: boolean;
  dateOfBirth: boolean;
  gender: boolean;
  country: boolean;
}

export const emptyBronzeChecks = (): BronzeChecks => ({
  governmentId: false,
  liveness: false,
  idFace: false,
  profileFace: false,
  dateOfBirth: false,
  gender: false,
  country: false,
});

export function canAwardBronze(checks: BronzeChecks): boolean {
  return Object.values(checks).every((passed) => passed === true);
}

/** Only a final, unambiguously positive callback can pass provider-owned checks. */
export function interpretSmileResult(payload: Record<string, unknown>) {
  const actions = (payload.Actions ?? {}) as Record<string, unknown>;
  const code = String(payload.ResultCode ?? "");
  // Smile can send separate action and ID-info callbacks in either order. The
  // callback adapter merges positive checks; neither callback alone grants Bronze.
  const verified = actions.Verify_ID_Number === "Verified" || code === "1012";
  const finalFaceApproval = code === "0810" || code === "1210";
  const live = finalFaceApproval && (actions.Liveness_Check === "Passed" ||
    actions.Human_Review_Liveness_Check === "Passed");
  const face = finalFaceApproval && (actions.Selfie_To_ID_Authority_Compare === "Completed" ||
    actions.Selfie_To_ID_Card_Compare === "Completed");
  const underReview = Object.values(actions).some((v) => v === "Under Review" || v === "Unable to Determine") ||
    /provisional|pending|review|inconclusive/i.test(String(payload.ResultText ?? ""));
  const failed = Object.values(actions).some((v) => v === "Failed" || v === "Not Verified") ||
    ["0811", "0812", "1013", "1014", "1211", "1212"].includes(code) ||
    /fail|reject|invalid|spoof|no match/i.test(String(payload.ResultText ?? ""));
  return { verified, live, face, underReview, failed, code };
}

/** A provider-level approval is insufficient without every required feature. */
export function interpretDiditResult(payload: Record<string, unknown>, profileCountry: string) {
  const reports = (key: string): Record<string, unknown>[] =>
    Array.isArray(payload[key]) ? (payload[key] as unknown[])
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)) : [];
  const approved = (key: string) => reports(key).some((report) => report.status === "Approved");
  const id = reports("id_verifications").find((report) => report.status === "Approved");
  const registry = reports("database_validations").some((report) => report.status === "Approved" &&
    Array.isArray(report.validations) && report.validations.some((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const check = value as Record<string, unknown>;
      return ["nga_national_id", "nga_bank_verification_number"].includes(String(check.service_id)) &&
        check.outcome_code === "MATCH";
    }));
  const lookup = id?.id_lookup && typeof id.id_lookup === "object" && !Array.isArray(id.id_lookup)
    ? id.id_lookup as Record<string, unknown> : null;
  const nigeriaLookup = lookup?.outcome === "match" &&
    /NIMC|NIBSS|National Identity Management Commission|Nigerian Banking/i.test(String(lookup.source ?? ""));
  const terminal = ["Approved", "Declined", "Expired", "Abandoned", "Kyc Expired"].includes(String(payload.status));
  const failed = ["Declined", "Expired", "Abandoned", "Kyc Expired"].includes(String(payload.status));
  return {
    terminal, failed,
    governmentId: Boolean(id) && (profileCountry.toUpperCase() !== "NG" || registry || nigeriaLookup),
    liveness: approved("liveness_checks"),
    idFace: approved("face_matches"),
    identity: id ? {
      DOB: typeof id.date_of_birth === "string" ? id.date_of_birth : "",
      Gender: typeof id.gender === "string" ? id.gender : "",
      Country: id.issuing_state === "NGA" ? "NG" : typeof id.issuing_state === "string" ? id.issuing_state : "",
    } : { DOB: "", Gender: "", Country: "" },
  };
}

/** Public profile data is member-chosen; compare the ID authority values only when present. */
export function matchIdentity(
  payload: Record<string, unknown>,
  profile: { dob: string; gender: string; country: string },
  now = new Date(),
) {
  const dob = typeof payload.DOB === "string" ? payload.DOB.slice(0, 10) : "";
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()))
    .toISOString().slice(0, 10);
  const gender = String(payload.Gender ?? "").trim().toLowerCase();
  const country = String(payload.Country ?? "").trim().toUpperCase();
  const normalizedGender = (value: string) => value.toLowerCase().startsWith("m") ? "m" : value.toLowerCase().startsWith("f") ? "f" : "";
  return {
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(dob) && dob <= cutoff && dob === profile.dob,
    gender: Boolean(gender) && normalizedGender(gender) !== "" && normalizedGender(gender) === normalizedGender(profile.gender),
    country: Boolean(country) && country === profile.country.toUpperCase(),
  };
}
