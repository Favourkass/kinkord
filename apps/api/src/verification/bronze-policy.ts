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
  /** The same identity is verified, in review or held on another account (checked under its lock). */
  duplicate?: boolean;
  /** Didit gave too little to fingerprint the identity, so a duplicate can't be ruled out. */
  bindingMissing?: boolean;
}) {
  const checks = {
    ...input.checks,
    profileFace: input.checks.profileFace && input.profileUnchanged,
  };
  const ended = (failureCodes: string[]) => ({
    checks,
    status:
      input.attemptNumber >= BRONZE_MAX_ATTEMPTS ? ("rejected" as const) : ("failed" as const),
    failureCodes,
  });
  if (input.status === "failed") return ended(input.failureCodes);
  if (!input.profileUnchanged) return ended(["PROFILE_CHANGED_DURING_VERIFICATION"]);
  // Whatever else passed, a possible second account is for a person to decide.
  const held = [
    ...(input.duplicate ? ["IDENTITY_ON_ANOTHER_ACCOUNT"] : []),
    ...(input.bindingMissing ? ["IDENTITY_FINGERPRINT_UNAVAILABLE"] : []),
  ];
  if (input.status === "manual_review" || (held.length && idChecksPass(checks))) {
    const failureCodes = [...new Set([...input.failureCodes, ...held])];
    return {
      checks,
      status: "manual_review" as const,
      failureCodes: failureCodes.length ? failureCodes : ["PROFILE_PHOTO_FACE_MATCH_REQUIRED"],
    };
  }
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

/** Didit's Nigerian registry lookups: the national identity number, and the bank one. */
const NIGERIA_REGISTRY_SERVICES = ["nga_national_id", "nga_bank_verification_number"];

/** Whether someone born on `dob` (YYYY-MM-DD) is an adult on `now`. */
export function adultOn(dob: string, now = new Date()) {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dob) && dob <= cutoff;
}

/**
 * A provider-level approval is insufficient without every required feature.
 * `member` is the profile the attempt checks against; it only stands in for
 * the ID's own country when Didit couldn't read it.
 */
export function interpretDiditResult(
  payload: Record<string, unknown>,
  member: { country: string; nationality: string | null },
  now = new Date(),
) {
  const reports = (key: string): Record<string, unknown>[] =>
    Array.isArray(payload[key])
      ? (payload[key] as unknown[]).filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) && typeof value === "object" && !Array.isArray(value),
        )
      : [];
  const approved = (key: string) => reports(key).some((report) => report.status === "Approved");
  const idReports = reports("id_verifications");
  const id = idReports.find((report) => report.status === "Approved");
  // Risk codes Didit raised on any ID report, including declined ones.
  const risks = new Set(
    idReports.flatMap((report) =>
      Array.isArray(report.warnings)
        ? report.warnings.map((warning: unknown) =>
            warning && typeof warning === "object"
              ? String((warning as Record<string, unknown>).risk ?? "")
              : "",
          )
        : [],
    ),
  );
  // A registry check counts once Didit approved it: a full match on its own,
  // a partial one only after Didit's reviewer approved it (the workflow sends
  // partial matches to review).
  const registry = reports("database_validations").some(
    (report) =>
      report.status === "Approved" &&
      Array.isArray(report.validations) &&
      report.validations.some((value: unknown) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const check = value as Record<string, unknown>;
        return (
          NIGERIA_REGISTRY_SERVICES.includes(String(check.service_id)) &&
          ["MATCH", "PARTIAL_MATCH"].includes(String(check.outcome_code))
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
  // A Nigerian ID must also check out against NIMC or NIBSS, whatever the
  // profile says; a foreign one never needs it. The profile decides only when
  // Didit couldn't read where the ID is from.
  const issuingState = field("issuing_state").trim().toUpperCase();
  const nigerianId = issuingState
    ? issuingState === "NGA"
    : [member.country, member.nationality].some((code) => code?.toUpperCase() === "NG");
  return {
    terminal,
    failed,
    /** Still with Didit's own reviewers; never expire it from our side. */
    inProviderReview: String(payload.status) === "In Review",
    governmentId: Boolean(id) && (!nigerianId || registry || nigeriaLookup),
    liveness: approved("liveness_checks"),
    idFace: approved("face_matches"),
    /** Didit found the same name and birth date under another member of ours. */
    possibleDuplicate: risks.has("POSSIBLE_DUPLICATED_USER"),
    /** The ID says the holder is under 18, whether or not Didit approved it. */
    underage:
      risks.has("MINIMUM_AGE_NOT_MET") ||
      idReports.some((report) => {
        const dob =
          typeof report.date_of_birth === "string" ? report.date_of_birth.slice(0, 10) : "";
        return /^\d{4}-\d{2}-\d{2}$/.test(dob) && !adultOn(dob, now);
      }),
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
  const normalizedGender = (value: string) =>
    value.trim().toLowerCase().startsWith("m")
      ? "m"
      : value.trim().toLowerCase().startsWith("f")
        ? "f"
        : "";
  return {
    dateOfBirth: adultOn(dob, now) && dob === profile.dob,
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
