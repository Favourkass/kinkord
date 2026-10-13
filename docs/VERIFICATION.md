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
   ID's birth date and gender must match the profile. A Nigerian-issued ID must
   also match its government record (NIN register, passport register or
   driver's licence register; a partial match counts only once Didit's own
   reviewers approve it; bank/BVN records don't count). Then the selfie is
   compared with the profile photo. Clear on everything: verified. Photo match
   or ID country unclear, or Didit finding a similar name and birth date
   (possible-duplicate warning) or the same face (face search) on another
   member: a Kinkord admin decides.

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
since, or if it's the admin's own case. Only a founder can decide, revoke or
reopen another admin's verification. Admins get a notification for each new
case. A member's Moderation page shows their status, with **Revoke
verification** and **Allow verifying again**.

Possible duplicates are decided here, not in Didit's console (the workflow
lets Didit flag them without holding the session):

- **The same identity on another account** (Kinkord's fingerprint of the
  ID's name, birth date and gender): **reject only**. One person, one verified
  account. The case shows which account holds it; the member can withdraw
  verification on that account first, and approval works once it's free.
- **Didit's possible duplicate** (a similar name and birth date) and **face
  search** (Didit compares each selfie with Kinkord's own verified members,
  never other companies'): the admin checks in Didit's console whether it's a
  different person, and decides.

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
| `testers` | Comma-separated Kinkord user IDs. While it lists anyone, verification is offered only to them (staff testing); empty offers it to every member. |

Keep the secret valid JSON. When the API can't read either secret it logs
`verification settings unavailable (<error> reading <secret>)` once, and
`verification settings read from <secret> again` once it can. Meanwhile it
keeps the last settings it read, so a switch flipped in the meantime doesn't
apply; without the fingerprint key, verification stays off.

The stable fingerprint key is the `bindingSecret` field in the separate
retained `kinkord/verification-binding` secret. Never rotate, delete, or
recreate it without a planned migration of all stored fingerprints. It's
replicated to Frankfurt (`eu-central-1`), where the database backups are
copied, because a restored backup's fingerprints are useless without it.

Neither secret's `generateSecretString` in `infra/lib/verification-stack.ts`
may change once deployed: CloudFormation regenerates a secret's whole value
when it does, wiping the Didit keys or replacing the fingerprint key.
`infra/lib/verification-stack.spec.ts` fails if either changes.

Locally the same settings come from `apps/api/.env` (see `.env.example`).
Anything missing keeps verification off.

## Switching it on

1. Legal sign-off on the notice at `/privacy/verification`, Didit's data
   processing terms and its retention settings.
2. Deploy the secrets and their read access, this stack only. From `infra/`:

   ```sh
   pnpm exec cdk diff KinkordVerification --exclusively
   pnpm exec cdk deploy KinkordVerification --exclusively --require-approval never
   ```

   The diff should show only the two secrets and the API's read policy. Never
   run a plain `cdk deploy`, or one without `--exclusively`: KinkordApi,
   KinkordApiBase and KinkordFoundation have drifted and must not be deployed.
   It creates `kinkord/verification` switched off and the separately retained
   `kinkord/verification-binding` key, then lets the API's existing role read
   both. It doesn't touch the API stacks.

   Then check the API can read them, without restarting or redeploying
   anything (it re-reads both every 5 minutes): after 5 minutes, search the
   API's App Runner application logs for `verification settings unavailable`.
   A line after the deploy, or an earlier one not followed by
   `verification settings read from <secret> again`, means the API can't read
   that secret: check the policy landed on the role App Runner actually uses
   (`apiInstanceRoleName` in `infra/bin/app.ts`).
3. Create the Didit workflow, from the repository root (not `infra/`).
   Sandbox may read the local development file:

   ```sh
   node --env-file=apps/api/.env scripts/provision-didit-bronze-workflow.mjs create sandbox
   ```

   Live asks for the key with the input hidden; paste it at the prompt. Never
   type it into a command or put it in a file (live refuses `--env-file`):

   ```sh
   node scripts/provision-didit-bronze-workflow.mjs create live
   ```

   If a workflow with the same label already exists, it's reused only if it
   matches the script; otherwise the script lists the differences and stops.
   Phone cameras only; desktop visitors get a QR code.
4. In Didit's console, point the webhook at `https://api.kinkord.com/webhooks/didit`.
5. Fill in the secret's Didit keys and workflow id, `diditMode` `live`, and
   `testers` with the staff test accounts' user IDs, then set `enabled` to
   `true`. It takes effect within 5 minutes, for those accounts only.
6. Run the [production smoke tests](#production-smoke-tests). Once they pass,
   empty `testers` to offer verification to every member.

## Operational ownership

Automation settles clear provider results, but Kinkord must assign trained
staff to both queues:

- **Kinkord Moderation → Verification** for profile-photo/country exceptions,
  possible duplicates (Kinkord's fingerprint, Didit's warning or its face
  search) and other cases the platform intentionally sends to a person.
- **Didit's own review queue** for partial government-record matches, which the workflow
  sends there and Kinkord accepts only once Didit's reviewer approves them,
  and any other session Didit holds for review. Those members wait until
  someone works it; Kinkord's moderation page doesn't replace it.

During launch, check both at least every working day and define an escalation
owner and response target before enabling verification for members.

## Production smoke tests

Run these after the migration and deploy, while `testers` limits
verification to the staff test accounts (step 5 of
[Switching it on](#switching-it-on)); empty `testers` only once they pass. Use
a real staff test account and a permitted test document; never put real
identity data in automated tests or screenshots.

1. With `enabled=false`, confirm Verification is absent from Settings and the
   member status endpoint reports unavailable.
2. Set `enabled=true` with `testers` set. Confirm a member not in `testers`
   still doesn't see Verification, and a tester sees the privacy notice link,
   explicit consent, and start button. Double-click Start and confirm only one
   local attempt and one billable Didit session exist.
3. Complete a live phone-camera flow with government ID, active liveness/video
   selfie, face-to-ID match, and (for a Nigerian-issued ID) the configured
   database validation. Confirm the callback is signed, the attempt settles,
   and the badge appears only after every required check passes.
4. Change the verified profile photo and confirm the public badge disappears
   and Moderation reports the status as `outdated`, not `verified`.
5. Force a manual-review case (verifying the same ID on a second test account
   must land here as a possible duplicate). Confirm the queue is inaccessible
   until the current admin session passes a six-digit 2FA step-up, self-review
   is refused, only a founder can decide another admin's case, and
   approve/reject records the reviewer, evidence, reason, and timestamp.
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
   either secret. If the API logs `verification settings unavailable` for
   `kinkord/verification`, it is still on the last settings it read: fix the
   secret (valid JSON, readable by the API's role).
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
   A changed key (saved over, or regenerated by a stack change) leaves the
   previous one as the secret's `AWSPREVIOUS` version; don't change the secret
   again before restoring it. Restore it by moving `AWSCURRENT` back to that
   version (the replica in Frankfurt follows):

   ```sh
   aws secretsmanager list-secret-version-ids --region eu-west-1 \
     --secret-id kinkord/verification-binding
   aws secretsmanager update-secret-version-stage --region eu-west-1 \
     --secret-id kinkord/verification-binding --version-stage AWSCURRENT \
     --move-to-version-id <AWSPREVIOUS version id> \
     --remove-from-version-id <AWSCURRENT version id>
   ```

   The API picks it up within five minutes. Fingerprints written while the
   wrong key was current won't match; note that window for the impact review.
7. **Biometric/privacy incident:** notify the privacy/security owner, follow the
   approved breach process and provider DPA, and preserve the erasure queue and
   audit logs for authorized investigation.
