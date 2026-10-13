import type { BronzeStatus } from "../db/schema";

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
  // Not finished at Didit: whatever has passed so far, wait for its decision.
  if (input.status === "processing")
    return { checks, status: "processing" as const, failureCodes: input.failureCodes };
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
  if (idChecksPass(checks))
    return {
      checks,
      status: "manual_review" as const,
      failureCodes: [
        ...(!checks.profileFace ? ["PROFILE_PHOTO_FACE_MATCH_REQUIRED"] : []),
        ...(!checks.country ? ["ID_COUNTRY_UNCONFIRMED"] : []),
      ],
    };
  // A finished result without what only the ID proves: nothing more is coming.
  return ended(input.failureCodes.length ? input.failureCodes : ["DIDIT_REQUIRED_CHECK_MISSING"]);
}

/**
 * What an admin's decision on a review does. Approving confirms the two
 * checks a person can judge (the profile photo and the ID's country); what
 * only the ID proves must already have passed. Rejecting fails the attempt,
 * so the member can try again if attempts remain. A review whose member has
 * since changed what was checked can't be approved, and ends like any other
 * changed profile. An identity that's on another account can only be
 * rejected: the member withdraws verification there first.
 */
export function reviewOutcome(input: {
  decision: "approve" | "reject";
  checks: Partial<BronzeChecks>;
  attemptsUsed: number;
  /** The photo, birth date and gender are still the ones the attempt checked. */
  profileUnchanged: boolean;
  /** The same identity is verified on, being reviewed for, or held against another account. */
  sameIdentityElsewhere: boolean;
}):
  | {
      ok: true;
      checks: BronzeChecks;
      status: BronzeStatus;
      attemptStatus: "verified" | "failed";
      failureCodes: string[];
    }
  | { ok: false; reason: "checks" | "duplicate" }
  | { ok: false; reason: "changed"; status: BronzeStatus; failureCodes: string[] } {
  const afterFailure: BronzeStatus =
    input.attemptsUsed >= BRONZE_MAX_ATTEMPTS ? "rejected" : "failed";
  if (input.decision === "reject")
    return {
      ok: true,
      checks: { ...emptyBronzeChecks(), ...input.checks },
      status: afterFailure,
      attemptStatus: "failed",
      failureCodes: ["MANUAL_REVIEW_REJECTED"],
    };
  const checks: BronzeChecks = {
    ...emptyBronzeChecks(),
    ...input.checks,
    profileFace: true,
    country: true,
  };
  if (!idChecksPass(checks) || !canAwardBronze(checks)) return { ok: false, reason: "checks" };
  if (!input.profileUnchanged)
    return {
      ok: false,
      reason: "changed",
      status: afterFailure,
      failureCodes: ["PROFILE_CHANGED_DURING_VERIFICATION"],
    };
  // One person, one verified account: that's for rejecting, never approving.
  if (input.sameIdentityElsewhere) return { ok: false, reason: "duplicate" };
  return { ok: true, checks, status: "verified", attemptStatus: "verified", failureCodes: [] };
}

/**
 * Didit's Nigerian government-record checks, one per kind of document: the
 * national identity (NIN) register, the passport register and the driver's
 * licence register.
 */
const NIGERIA_REGISTRY_SERVICES = ["nga_national_id", "nga_passport", "nga_drivers_license"];
/** Didit's face search found this selfie's face on another of our members. */
const FACE_ELSEWHERE_RISKS = [
  "DUPLICATED_FACE",
  "POSSIBLE_DUPLICATED_FACE",
  "DUPLICATED_FACE_NAME_MISMATCH",
  "DUPLICATED_FACE_DOCUMENT_MISMATCH",
  "POSSIBLE_FACE_IN_BLOCKLIST",
];

/**
 * Whether someone born on `dob` (YYYY-MM-DD) is 18 on `now`, by calendar age.
 * (Subtracting 18 years from 29 February would roll over to 1 March and let a
 * 17-year-old through.)
 */
export function adultOn(dob: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const [year, month, day] = dob.split("-").map(Number);
  const [nowMonth, nowDay] = [now.getUTCMonth() + 1, now.getUTCDate()];
  const beforeBirthday = nowMonth < month || (nowMonth === month && nowDay < day);
  return now.getUTCFullYear() - year - (beforeBirthday ? 1 : 0) >= 18;
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
  // Risk codes Didit raised on a feature's reports, including declined ones.
  const risksOf = (list: Record<string, unknown>[]) =>
    new Set(
      list.flatMap((report) =>
        Array.isArray(report.warnings)
          ? report.warnings.map((warning: unknown) =>
              warning && typeof warning === "object"
                ? String((warning as Record<string, unknown>).risk ?? "")
                : "",
            )
          : [],
      ),
    );
  const risks = risksOf(idReports);
  const faceRisks = risksOf(reports("liveness_checks"));
  // A government-record check counts once Didit approved it: a full match on
  // its own, a partial one only after Didit's reviewer approved it (the
  // workflow sends partial matches to review). Bank (BVN) records don't count.
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
    /NIMC|National Identity Management Commission/i.test(String(lookup.source ?? ""));
  const terminal = ["Approved", "Declined", "Expired", "Abandoned", "Kyc Expired"].includes(
    String(payload.status),
  );
  const failed = ["Declined", "Expired", "Abandoned", "Kyc Expired"].includes(
    String(payload.status),
  );
  const field = (key: string) => (id && typeof id[key] === "string" ? (id[key] as string) : "");
  // A Nigerian ID must also check out against its government record, whatever
  // the profile says; a foreign one never needs it. The profile decides only when
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
    /** Didit's face search matched this selfie to another of our members. */
    faceElsewhere: FACE_ELSEWHERE_RISKS.some((risk) => faceRisks.has(risk)),
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
