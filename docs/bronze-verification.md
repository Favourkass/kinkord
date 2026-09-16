# Bronze verification (local implementation)

This is a gated integration, not an automatic Bronze award from one provider result. Didit is primary and Smile ID remains a technical fallback. The page is at `/settings/verification/bronze`.

## Provider setup

Didit primary (API server only): set `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID` (published workflow), `DIDIT_RETURN_URL`, `DIDIT_WEBHOOK_SECRET`, and `BRONZE_POLICY_URL` (approved biometric/ID privacy notice). The workflow must include government ID, liveness, face match, and Nigerian NIN/BVN registry validation where applicable. Register the public HTTPS `/webhooks/didit` endpoint in the Didit console for production. Localhost has no public webhook; the status endpoint also re-fetches Didit decisions while pending. Store the API key and webhook secret in server-side secrets, never in source or `NEXT_PUBLIC_*`. AWS expects `ARN_DIDIT_API_KEY` and `ARN_DIDIT_WEBHOOK_SECRET` pointing to Secrets Manager values.

Didit returns a hosted verification URL. The API re-fetches the decision and requires matching session, workflow and user before deriving checks. A Didit-level approval alone never grants Bronze: all required feature checks and profile identity fields must pass. Missing Nigerian registry, DOB, gender, or country evidence fails closed. The profile-photo-to-live-face match still requires an authorized manual review.

Smile fallback: configure `SMILE_ID_PARTNER_ID`, `SMILE_ID_API_KEY`, `SMILE_ID_ENVIRONMENT` (`sandbox` or `live`), `SMILE_ID_CALLBACK_URL` (public HTTPS `/webhooks/smile-id`), and `SMILE_ID_POLICY_URL`. Store the API key in the `kinkord/smile-id` AWS secret and pass its full ARN as `ARN_SMILE_ID_API_KEY` to the infrastructure deployment. Keep production disabled until both provider workflows and the callback URLs have been tested.

The API issues a Didit hosted session (or a Smile hosted token on fallback) after a member accepts versioned consent, supplies DOB/gender/country and uploads a profile photo within 90 days. The provider handles government ID entry and live camera capture. Callbacks are authenticated, correlated to the reserved user/session, and re-fetched from the provider before deciding. Only derived check flags, references, consent timestamps, reviewer decisions, and audit metadata are kept in Postgres; raw ID numbers, documents, biometric media, and callback bodies are not stored.

## Bronze decision and manual review

An approved biometric action, a verified ID, and matching DOB/gender/country are required. A completed government-ID face comparison **does not** prove that the same face matches the Kinkord profile photo. Until a separately validated automated comparison has compared the live selfie to the exact avatar snapshot, a positive provider result enters `manual_review` with reason `PROFILE_PHOTO_FACE_MATCH_REQUIRED`, not `verified`.

Set `BRONZE_REVIEWER_EMAILS` to an exact comma-separated allowlist of staff accounts with two-factor authentication enabled. Authenticated reviewers can GET `/verification/bronze/reviews` (open cases with provider session reference and a short-lived signed current-photo URL) and POST `/verification/bronze/reviews/:id/decision` with JSON `{ "decision": "approve" | "reject", "profileFaceMatches": true | false, "evidenceReference": "provider job / internal case reference", "reason": "review notes, at least ten characters" }`. Approval is refused unless every other derived check passed and the user's current avatar is still the avatar captured at attempt start. Reviewers must compare the actual provider liveness capture to that avatar using their authorized provider-portal access before setting `profileFaceMatches: true`. Access and decisions are logged server-side; decisions, reviewer IDs, reasons and evidence references are persisted. Do not place document numbers or raw biometric data in those text fields.

Three attempts are the maximum. Failed attempts 1 and 2 can retry; the third failure enters the review queue. Pending sessions expire after 24 hours and count as a failed attempt. A manual review never silently approves a missing check. A Bronze badge is emitted only when the status is `verified` and the currently displayed avatar key still matches the verified avatar snapshot.

## Before release

Complete and sign off the privacy/retention notice and provider DPA, confirm exact Nigerian registry and ID-sourced demographic fields from the published Didit workflow, exercise real signed callbacks and adverse/provisional cases, and confirm the hosted camera flow across mobile and desktop browsers. Set a retention/deletion job for consent, attempts, callback fingerprints, and closed review audit records under the approved retention schedule. Provide an avatar-change re-verification/review workflow: the badge currently disappears if the approved avatar changes, but an already verified account cannot self-start a fresh attempt. An automated avatar-to-live-face comparison is not wired yet. Run DB migration `0007` in staging and test recovery before any production rollout.

Didit official references: [API full flow](https://docs.didit.me/integration/api-full-flow), [webhooks](https://docs.didit.me/integration/webhooks), [decision retrieval](https://docs.didit.me/sessions-api/retrieve-session), [statuses](https://docs.didit.me/integration/verification-statuses).

## Local smoke test

1. Start local PostgreSQL and MinIO using `docker compose up -d postgres minio minio-init`, then run `corepack pnpm --filter api db:migrate` for migration `0007`.
2. Fill the ignored `apps/api/.env` file with a sandbox `DIDIT_API_KEY`, a **published** `DIDIT_WORKFLOW_ID`, and an approved `BRONZE_POLICY_URL`. Keep `DIDIT_RETURN_URL=http://localhost:3000/settings/verification/bronze`. A webhook secret is needed only to receive callbacks; local status polling also works without a public webhook.
3. Run `corepack pnpm --filter api dev` and `corepack pnpm --filter web dev`. Sign in at `http://localhost:3000/login`, add DOB/gender/country and a recent avatar at `http://localhost:3000/profile/edit`, then open `http://localhost:3000/settings/verification/bronze`.
4. Consent, start verification, complete the Didit hosted camera flow and return to the Bronze page. Refresh status. A fully passing provider decision should land in manual review for the separate avatar-to-live-face check, never instantly award the badge. Reviewers must have 2FA and be listed in `BRONZE_REVIEWER_EMAILS`.

Do not run live user IDs or biometrics through an unapproved notice or an unreviewed workflow. Use Didit's sandbox/test data until the DPA, retention schedule, and exact output mapping have been signed off.

Smile ID official integration references: [Hosted Web Integration](https://docs.usesmileid.com/integration-options/web-mobile-web/web-integration), [Web token](https://docs.usesmileid.com/integration-options/server-to-server/javascript/generate-token-for-web-integration), [Biometric KYC](https://docs.usesmileid.com/products/for-individuals-kyc/biometric-kyc), [SmartSelfie Compare](https://docs.usesmileid.com/products/for-individuals-kyc/smartselfie-tm-compare).
