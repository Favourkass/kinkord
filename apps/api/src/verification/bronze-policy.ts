export const BRONZE_POLICY_VERSION = "bronze-2026-10-03-identity-v3";
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
  return (Object.keys(emptyBronzeChecks()) as (keyof BronzeChecks)[]).every(
    (key) => checks[key] === true,
  );
}

/**
 * What only the ID itself can prove. If any fails, the attempt fails; nobody
 * can approve it by hand. The profile-photo match and the country are the two
 * checks an admin may confirm instead.
 */
export function idChecksPass(checks: BronzeChecks): boolean {
  return (
    checks.governmentId && checks.liveness && checks.idFace && checks.dateOfBirth && checks.gender
  );
}

export function bronzeCallbackOutcome(input: {
  checks: BronzeChecks;
  status: "processing" | "failed" | "manual_review" | "verified";
  failureCodes: string[];
  attemptNumber: number;
  profileUnchanged: boolean;
}) {
  const checks = {
    ...input.checks,
    profileFace: input.checks.profileFace && input.profileUnchanged,
  };
  if (input.status === "failed")
    return {
      checks,
      status:
        input.attemptNumber >= BRONZE_MAX_ATTEMPTS ? ("rejected" as const) : ("failed" as const),
      failureCodes: input.failureCodes,
    };
  if (!input.profileUnchanged)
    return {
      checks,
      status: "manual_review" as const,
      failureCodes: ["PROFILE_CHANGED_DURING_VERIFICATION"],
    };
  if (input.status === "manual_review")
    return {
      checks,
      status: "manual_review" as const,
      failureCodes: input.failureCodes.length
        ? input.failureCodes
        : ["PROFILE_PHOTO_FACE_MATCH_REQUIRED"],
    };
  if (canAwardBronze(checks)) return { checks, status: "verified" as const, failureCodes: [] };
  return idChecksPass(checks)
    ? {
        checks,
        status: "manual_review" as const,
        failureCodes: [
          ...(!checks.profileFace ? ["PROFILE_PHOTO_FACE_MATCH_REQUIRED"] : []),
          ...(!checks.country ? ["ID_COUNTRY_UNCONFIRMED"] : []),
        ],
      }
    : { checks, status: "processing" as const, failureCodes: input.failureCodes };
}

/** A provider-level approval is insufficient without every required feature. */
export function interpretDiditResult(payload: Record<string, unknown>, profileCountry: string) {
  const reports = (key: string): Record<string, unknown>[] =>
    Array.isArray(payload[key])
      ? (payload[key] as unknown[]).filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) && typeof value === "object" && !Array.isArray(value),
        )
      : [];
  const approved = (key: string) => reports(key).some((report) => report.status === "Approved");
  const id = reports("id_verifications").find((report) => report.status === "Approved");
  const registry = reports("database_validations").some(
    (report) =>
      report.status === "Approved" &&
      Array.isArray(report.validations) &&
      report.validations.some((value: unknown) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const check = value as Record<string, unknown>;
        return (
          ["nga_national_id", "nga_bank_verification_number"].includes(String(check.service_id)) &&
          check.outcome_code === "MATCH"
        );
      }),
  );
  const lookup =
    id?.id_lookup && typeof id.id_lookup === "object" && !Array.isArray(id.id_lookup)
      ? (id.id_lookup as Record<string, unknown>)
      : null;
  const nigeriaLookup =
    lookup?.outcome === "match" &&
    /NIMC|NIBSS|National Identity Management Commission|Nigerian Banking/i.test(
      String(lookup.source ?? ""),
    );
  const terminal = ["Approved", "Declined", "Expired", "Abandoned", "Kyc Expired"].includes(
    String(payload.status),
  );
  const failed = ["Declined", "Expired", "Abandoned", "Kyc Expired"].includes(
    String(payload.status),
  );
  const field = (key: string) => (id && typeof id[key] === "string" ? (id[key] as string) : "");
  return {
    terminal,
    failed,
    /** Still with Didit's own reviewers; never expire it from our side. */
    inProviderReview: String(payload.status) === "In Review",
    // A Nigerian member's ID must also check out against NIMC or NIBSS.
    governmentId:
      Boolean(id) && (profileCountry.toUpperCase() !== "NG" || registry || nigeriaLookup),
    liveness: approved("liveness_checks"),
    idFace: approved("face_matches"),
    identity: {
      DOB: field("date_of_birth"),
      Gender: field("gender"),
      IssuingState: field("issuing_state"),
      IssuingStateName: field("issuing_state_name"),
      FullName:
        field("full_name") || [field("first_name"), field("last_name")].filter(Boolean).join(" "),
    },
  };
}

const regionName = (() => {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return (alpha2: string) => {
    try {
      return names.of(alpha2.toUpperCase()) ?? "";
    } catch {
      return "";
    }
  };
})();
const comparable = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/**
 * Whether the ID was issued by the member's nationality, or failing that their
 * country. Matched by the country's name, since Didit gives three-letter codes
 * and profiles two-letter ones. False means "not confirmed", never "wrong":
 * an admin decides those.
 */
export function idCountryMatches(
  id: { IssuingState: string; IssuingStateName: string },
  member: { country: string; nationality: string | null },
): boolean {
  const candidates = [member.nationality, member.country].filter((code): code is string =>
    Boolean(code && /^[A-Za-z]{2}$/.test(code)),
  );
  return candidates.some(
    (code) =>
      (code.toUpperCase() === "NG" && id.IssuingState.toUpperCase() === "NGA") ||
      (Boolean(id.IssuingStateName) &&
        comparable(regionName(code)) === comparable(id.IssuingStateName)),
  );
}

/** The ID's details against the profile; an adult, and the same birth date and gender. */
export function matchIdentity(
  identity: { DOB: string; Gender: string; IssuingState: string; IssuingStateName: string },
  profile: { dob: string; gender: string; country: string; nationality: string | null },
  now = new Date(),
) {
  const dob = identity.DOB.slice(0, 10);
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  const normalizedGender = (value: string) =>
    value.trim().toLowerCase().startsWith("m")
      ? "m"
      : value.trim().toLowerCase().startsWith("f")
        ? "f"
        : "";
  return {
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(dob) && dob <= cutoff && dob === profile.dob,
    gender:
      normalizedGender(identity.Gender) !== "" &&
      normalizedGender(identity.Gender) === normalizedGender(profile.gender),
    country: idCountryMatches(identity, profile),
  };
}

/** Whether a verification still stands for the profile as it is now. */
export function stillVerified(
  state:
    | {
        status: string;
        verifiedAvatarKey: string | null;
        verifiedDob: string | null;
        verifiedGender: string | null;
      }
    | null
    | undefined,
  profile: { avatarKey: string | null; dateOfBirth: string | null; gender: string | null },
): boolean {
  return (
    state?.status === "verified" &&
    Boolean(state.verifiedAvatarKey) &&
    state.verifiedAvatarKey === profile.avatarKey &&
    state.verifiedDob === profile.dateOfBirth &&
    state.verifiedGender === profile.gender
  );
}
