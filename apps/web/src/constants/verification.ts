import type { BronzeFailure, BronzeRequirement, BronzeStatus } from "@/domain/bronzeVerification";

/** Copy for Settings → Verification. */
export const VERIFICATION_COPY = {
  title: "Verification",
  intro:
    "Verify your identity to get Kinkord's gold seal on your profile. Didit processes your ID and selfie; authorized Kinkord reviewers may access verification evidence when a manual review is needed.",
  loading: "Loading…",
  retryLoad: "Try again",
  statusHeading: "Status",
  statuses: {
    not_started: { label: "Not verified", detail: "You haven't verified your identity yet." },
    pending: {
      label: "Checking",
      detail:
        "Didit is checking your ID and selfie. This page updates by itself, and we'll let you know when it's done.",
    },
    failed: {
      label: "Not passed",
      detail: "Your last check didn't pass. You can try again.",
    },
    manual_review: {
      label: "With our team",
      detail: "A Kinkord admin is looking at your check. We'll let you know when there's a result.",
    },
    verified: {
      label: "Verified",
      detail: "Your identity has been checked.",
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
  /** Pending, but the member left Didit before finishing. */
  unfinished: {
    label: "Not finished",
    detail: "You left Didit before finishing. Continue to pick up where you left off.",
  },
  /** A status newer than this page: shown plainly instead of breaking. */
  unknownStatus: {
    label: "Status unavailable",
    detail: "This page is out of date. Refresh it to see your status.",
  },
  /** Why the last check didn't pass: what went wrong and what to fix. */
  failures: {
    birth_date:
      "The birth date on your ID doesn't match your profile. If your profile is wrong, correct it in Edit profile.",
    gender:
      "The gender on your ID doesn't match your profile. If your profile is wrong, correct it in Edit profile.",
    registry:
      "The national identity (NIN) registry couldn't confirm the details on your ID. Use a valid, current ID.",
    declined:
      "Your ID couldn't be accepted. Use a valid, unexpired government ID, with the whole card in view and no glare.",
    liveness:
      "The live selfie didn't pass. Face the camera in good light, with nothing covering your face.",
    face: "Your selfie didn't match the photo on your ID. Take the selfie in good light with your whole face in view, and use an ID with a clear photo of you.",
    profile_changed:
      "Your photo, birth date or gender changed while the check was running, so it couldn't finish.",
    expired: "The check wasn't finished in time, so it expired.",
    other:
      "Your check couldn't be completed. Make sure your ID is valid and clear, and your profile photo is a recent photo of you.",
  } satisfies Record<BronzeFailure, string>,
  attemptsLeft: (n: number) => (n === 1 ? "1 attempt left." : `${n} attempts left.`),
  badgeHint: "You can show or hide your badge in Edit profile → Privacy.",
  badgeHintLink: "Privacy settings",
  unavailable: "Verification isn't open yet.",
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
    "Your government ID. An ID issued in Nigeria is also checked against the national identity (NIN) registry.",
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
  resume: "Continue verification",
  starting: "Opening Didit…",
  /** Said under the start button while it's held, so members know why. */
  startHints: {
    profile: "Add what's listed above to your profile first.",
    photo: "You can start once your new photo is ready.",
    consent: "Tick the box above to agree, then you can start.",
  },
  refresh: "Refresh status",
  withdraw: {
    button: "Withdraw consent",
    title: "Withdraw your consent?",
    /** Members who are rejected, revoked or out of attempts verify again through support. */
    body: (needsSupport: boolean) =>
      `This stops any check in progress, removes your verified badge and asks Didit to delete any verification sessions it holds for you. Failed deletion requests are retried. ${
        needsSupport
          ? "To verify again after this, contact support."
          : "You can verify again later."
      }`,
    confirm: "Withdraw",
    busy: "Withdrawing…",
    cancel: "Keep",
    done: "Consent withdrawn. Anything Didit held for you is being erased.",
  },
  errors: {
    load: "Couldn't load your verification.",
    start: "Couldn't start verification. Try again.",
    resume: "Couldn't continue verification. Try again.",
    withdraw: "Couldn't withdraw your consent. Try again.",
    badLink: "Didit sent back a link we don't recognise, so we didn't open it. Try again.",
  },
} as const;
