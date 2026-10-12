# Identity verification

A member proves who they are with a government ID and a live selfie, and that
the selfie matches their profile photo. It earns the gold **Identity verified**
badge. The checks run in Didit's hosted flow; Kinkord keeps only the results.
In code and the database it's called "Bronze" (`bronze_*` tables,
`/verification/bronze`), the first tier.

It ships switched off. Nothing reaches Didit until the steps in
[Switching it on](#switching-it-on) are done.

## How a check runs

1. **Settings → Verification** (`/settings/verification`). The member needs a
   profile photo uploaded in the last 90 days (and at least 10 minutes ago),
   a date of birth, gender and country.
2. They tick the consent box. Consent is recorded against the policy version
   (`BRONZE_POLICY_VERSION`); the wording for each version lives in
   `apps/web/src/constants/verification.ts`, and the page refuses to record a
   version it has no wording for.
3. The API regenerates the photo's smaller sizes from the original, so the
   photo members see is the one being checked, then opens a Didit session and
   sends the member there.
4. Didit calls `POST /webhooks/didit` (signed). The API answers at once,
   fetches the decision itself, and checks it belongs to this session, member
   and workflow. Every 5 minutes it also settles sessions whose webhook was
   missed, and expires them after 24 hours unless Didit is still reviewing.
5. The ID must pass, liveness must pass, the selfie must match the ID, and the
   ID's birth date and gender must match the profile (Nigerian IDs also need a
   NIMC lookup). Then the selfie is compared with the profile photo. Clear on
   everything: verified. Photo match or ID country unclear, or the same
   identity verified on another account: an admin decides.

A member has 3 attempts. After the third failure only an admin can reopen it.
Changing the profile photo, birth date or gender hides the badge until they
verify again (status `outdated`).

## Admin review

**Moderation → Verification** (`/moderation/verification`), for the same
admins who moderate. Reviewing needs a current authenticator code for that
exact browser session; merely enabling 2FA on the account is not enough. The
step-up lasts 10 minutes.
Each case shows the photo as members see it, the original upload, the reasons,
each check and the Didit session id (to look at the ID and selfie in Didit's
console). Approving needs an evidence reference and a reason, and is refused if
the ID checks failed, if the member changed their photo, birth date or gender
since, or if it's the admin's own case. Admins get a notification for each new
case. A member's Moderation page shows their status, with **Revoke
verification** and **Allow verifying again**.

## What's stored

Kinkord keeps consent records, attempts, pass/fail checks, reason codes, the
photo-comparison score and threshold, review decisions and a keyed fingerprint
of the ID's name, birth date and gender (HMAC with `bindingSecret`, to spot one
identity on several accounts). No ID image, ID number, selfie or video.

Withdrawing consent (on the Verification page) stops any check, removes the
badge, clears the fingerprint and asks Didit to delete the member's sessions.
Deleting an account from Moderation first puts every Didit session into the
durable `verification_erasure` queue. Account-owned verification rows then go
with the account, while failed provider deletions remain retryable.

Members can hide the badge in Edit profile → Privacy; friends-only profiles
show it only to friends. The public notice is `/privacy/verification`
(`apps/web/src/presenters/getVerificationPrivacyVM.ts`).

## Settings

Production reads the `kinkord/verification` settings and the separately
retained `kinkord/verification-binding` key every 5 minutes, so verification
can be switched on or off from Secrets Manager without a deploy:

| Key | Meaning |
| --- | --- |
| `enabled` | The switch. Only `true` once the privacy notice is approved. |
| `policyUrl` | The approved notice, `https://kinkord.com/privacy/verification`. |
| `returnUrl` | Where Didit sends members back, `https://kinkord.com/settings/verification`. |
| `diditApiKey`, `diditWebhookSecret` | From the Didit app's API & Webhooks page. |
| `diditWorkflowId` | From the provisioning script below. |
| `diditMode` | `live` in production; sandbox sessions never verify anyone there. |
| `profileMatchEnabled`, `profileMatchThreshold` | Automatic selfie-to-photo comparison (90–100). Off sends every case to an admin. |

The stable fingerprint key is the `bindingSecret` field in the separate
retained `kinkord/verification-binding` secret. Never rotate, delete, or
recreate it without a planned migration of all stored fingerprints.

Locally the same settings come from `apps/api/.env` (see `.env.example`).
Anything missing keeps verification off.

## Switching it on

1. Legal sign-off on the notice at `/privacy/verification`, Didit's data
   processing terms and its retention settings.
2. Deploy the secret and its read access: from `infra/`,
   `pnpm exec cdk diff KinkordVerification --exclusively`, then
   `pnpm exec cdk deploy KinkordVerification --exclusively --require-approval never`.
   It creates `kinkord/verification` switched off and the separately retained
   `kinkord/verification-binding` key, then lets the API's existing role read
   both. It doesn't touch the API stacks.
3. Create the Didit workflow. Sandbox may read the local development file:
   `node --env-file=apps/api/.env
   scripts/provision-didit-bronze-workflow.mjs create sandbox`. For live, put
   the key only in the current shell, never in `.env`:

   ```powershell
   $env:DIDIT_LIVE_API_KEY = "paste-live-key-here"
   node scripts/provision-didit-bronze-workflow.mjs create live
   Remove-Item Env:DIDIT_LIVE_API_KEY
   ```

   Phone cameras only; desktop visitors get a QR code.
4. In Didit's console, point the webhook at `https://api.kinkord.com/webhooks/didit`.
5. Fill in the secret's keys, `diditMode` `live`, then `enabled` `true`.
   It takes effect within 5 minutes.

## Operational ownership

Automation settles clear provider results, but Kinkord must assign trained
staff to both queues:

- **Kinkord Moderation → Verification** for profile-photo/country exceptions
  and other cases the platform intentionally sends to a person.
- **Didit's own review queue** for sessions Didit holds for document or
  biometric review. This queue is not replaced by Kinkord's moderation page.

During launch, check both at least every working day and define an escalation
owner and response target before enabling verification for members.

## Production smoke tests

Run these after the migration and deploy, before broad enablement. Use a real
staff test account and a permitted test document; never put real identity data
in automated tests or screenshots.

1. With `enabled=false`, confirm Verification is absent from Settings and the
   member status endpoint reports unavailable.
2. Enable it and confirm the privacy notice link, explicit consent, and start
   button appear. Double-click Start and confirm only one local attempt and one
   billable Didit session exist.
3. Complete a live phone-camera flow with government ID, active liveness/video
   selfie, face-to-ID match, and (for a Nigerian-issued ID) the configured
   database validation. Confirm the callback is signed, the attempt settles,
   and the badge appears only after every required check passes.
4. Change the verified profile photo and confirm the public badge disappears
   and Moderation reports the status as `outdated`, not `verified`.
5. Force a manual-review case. Confirm the queue is inaccessible until the
   current admin session passes a six-digit 2FA step-up, self-review is refused,
   and approve/reject records the reviewer, evidence, reason, and timestamp.
6. Revoke and reopen a different member. Confirm both demand a reason and a
   fresh/current session step-up and appear in the moderation log.
7. Withdraw consent, then delete another test account. Confirm provider session
   IDs remain in `verification_erasure` until Didit accepts deletion, including
   across a temporary Didit outage and API restart.
8. Let a pending session exceed its expiry while provider result retrieval
   fails. Confirm it expires locally and does not remain pending forever.

## Incident steps

1. **Stop new checks:** set `enabled` to `false` in `kinkord/verification`.
   Confirm the member entry disappears within five minutes. Do not delete
   either secret.
2. **Preserve evidence:** record UTC start/end time, affected workflow/session
   IDs, deployment version, API logs, webhook delivery status, and counts only.
   Do not paste ID images, selfies, API keys, or webhook secrets into tickets.
3. **Provider/webhook failure:** inspect Didit's status and webhook deliveries,
   verify signatures and timestamps, then use reconciliation after recovery.
   Never mark a user verified manually just to clear an outage.
4. **Deletion backlog:** query incomplete `verification_erasure` rows by
   `next_attempt_at` and `last_error`; restore provider access and let retries
   complete. Never delete failed rows to silence the queue.
5. **Credential exposure:** disable verification, rotate only the affected
   Didit API/webhook credential, update `kinkord/verification`, and validate a
   signed test callback. Never rotate `kinkord/verification-binding` as part of
   ordinary credential response.
6. **Suspected fingerprint-key loss/change:** keep verification disabled and
   escalate to engineering and privacy leadership. Do not generate another key
   or resume duplicate detection until a migration and impact review exist.
7. **Biometric/privacy incident:** notify the privacy/security owner, follow the
   approved breach process and provider DPA, and preserve the erasure queue and
   audit logs for authorized investigation.
