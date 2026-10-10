import type { BronzeRequirement, BronzeStatus } from "@/domain/bronzeVerification";

/** Copy for Settings → Verification. */
export const VERIFICATION_COPY = {
  title: "Verification",
  intro:
    "Verify your identity to get Kinkord's gold seal on your profile. Your ID and selfie are never shown to anyone.",
  loading: "Loading…",
  statusHeading: "Status",
  statuses: {
    not_started: { label: "Not verified", detail: "You haven't verified your identity yet." },
    pending: {
      label: "Checking",
      detail: "Didit is checking your ID and selfie. This page updates by itself.",
    },
    failed: {
      label: "Not passed",
      detail: "Your last check didn't pass. You can try again.",
    },
    manual_review: {
      label: "With our team",
      detail: "A Kinkord admin is looking at your check. Your result will show here.",
    },
    verified: {
      label: "Verified",
      detail: "Your profile shows that your identity has been checked.",
    },
    outdated: {
      label: "Verify again",
      detail:
        "You changed your photo, birth date or gender after verifying, so your badge is hidden until you verify again.",
    },
    rejected: {
      label: "Not approved",
      detail: "Your verification wasn't approved. Contact support if you think that's wrong.",
    },
    revoked: {
      label: "Removed",
      detail: "Your verification was removed by an admin. Contact support to find out more.",
    },
  } satisfies Record<BronzeStatus, { label: string; detail: string }>,
  attemptsLeft: (n: number) => (n === 1 ? "1 attempt left." : `${n} attempts left.`),
  badgeHint: "You can hide the badge in Edit profile → Privacy.",
  badgeHintLink: "Privacy settings",
  unavailable: "Verification isn't open yet. We'll let you know when it is.",
  needsHeading: "Before you start",
  needs: "Add these to your profile first:",
  missing: {
    profilePhoto: "a clear photo of yourself, uploaded in the last 90 days",
    dateOfBirth: "your date of birth",
    gender: "your gender",
    country: "your country",
  } satisfies Record<BronzeRequirement, string>,
  editProfile: "Edit profile",
  photoSettling: (time: string) =>
    `Your photo was just uploaded. You can verify from ${time}, so the check uses the photo members see.`,
  checksHeading: "What we check",
  checks: [
    "Your government ID. Nigerian IDs are also checked against NIMC or bank (BVN) records.",
    "A live selfie, matched to the photo on your ID.",
    "That selfie against your Kinkord profile photo.",
    "Your date of birth, gender and country against your profile.",
  ],
  checksNote:
    "A clear result is decided automatically. If something is unclear, a Kinkord admin reviews it. You have 3 attempts.",
  privacyLink: "Read the verification privacy notice",
  /**
   * Consent wording per API policy version. A version missing here means this
   * page is older than the API, so it shows `outdatedPage` instead of agreeing
   * on the member's behalf to wording they haven't seen.
   */
  consent: {
    "bronze-2026-10-03-identity-v3":
      "I have read the verification privacy notice. I explicitly consent to Kinkord and its provider Didit processing my government ID, a live selfie and my current profile photo, including facial (biometric) data, to verify my identity, prevent fraud and review the result. I understand a clear result may be decided automatically, an unclear one is reviewed by a Kinkord admin, and I can withdraw my consent on this page at any time.",
  } as Record<string, string>,
  outdatedPage: "This page is out of date. Refresh it to see the latest consent wording.",
  start: "Verify with Didit",
  retry: "Try again",
  reverify: "Verify again",
  starting: "Opening Didit…",
  refresh: "Refresh status",
  withdraw: {
    button: "Withdraw consent",
    title: "Withdraw your consent?",
    body: "This stops any check in progress, removes your verified badge and asks Didit to delete your ID and selfie. You can verify again later.",
    confirm: "Withdraw",
    cancel: "Keep",
    done: "Consent withdrawn. Your verification data is being deleted.",
  },
  errors: {
    load: "Couldn't load your verification. Try again.",
    start: "Couldn't start verification. Try again.",
    withdraw: "Couldn't withdraw your consent. Try again.",
    badLink: "Didit sent back a link we don't recognise, so we didn't open it. Try again.",
  },
} as const;
