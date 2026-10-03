# Kinkord KYC — implementation continuity

## Product decision

Kinkord has one verification product: **Kinkord KYC**. Do not introduce Bronze, Gold, or tiered KYC labels in member-facing copy, routes, badges, policy pages, or staff interfaces.

Kinkord KYC is only awarded after the approved policy verifies all required domains:

1. live biometric/liveness;
2. government ID and identity-detail match;
3. consented live-location evidence;
4. residence/proof-of-address evidence; and
5. licensed financial KYC/account-ownership evidence.

Profile-photo comparison is an anti-impersonation signal. It is not a substitute for government ID and must not silently become the sole KYC criterion.

## Phase status

### Phase 1 — naming, safety and continuity (completed)

- Introduced the `/settings/kyc`, `/settings/kyc/reviews`, and `/privacy/kyc` public routes.
- Preserve old verification paths as redirects, because audit records, bookmarks and provider return URLs may still reference them.
- Keep existing `bronze_*` database structures as **legacy identity-verification data**. Never automatically promote a legacy approved record to `Kinkord KYC Verified`: it lacks location, address and financial checks.
- Official KYC seal: `/brand/kinkord-kyc-verified-badge-v1.png`. It is a transparent, isolated version of the user-supplied artwork. Use it only for a genuinely KYC-verified public state.

### Phase 2 — KYC domain and identity foundation (completed)

- Added KYC case, attempt, provider-session, derived-evidence, separate-consent and audit-event tables in migration `0010_cold_quicksilver.sql`, alongside legacy tables.
- Added a fail-closed KYC policy: the official seal requires passed identity, location, residence and financial stages; the identity stage itself requires government ID, liveness, ID-face, profile-face and identity-detail checks.
- Next: move the existing Didit identity/liveness/profile-photo logic behind a KYC identity-provider adapter without deleting legacy records.
- The authenticated `GET /verification/kyc/status` endpoint and `/settings/kyc` progress display now expose all KYC safeguards. A verified legacy identity result may complete **only** the identity safeguard and can never award the official seal by itself.
- Keep raw IDs, selfies, videos, images, provider callback bodies and bank details out of Kinkord storage unless separately approved by law, security and retention policy.

### Phase 3 — location and residence (in progress)

- Add explicit location consent; store only minimized location decision data, accuracy and timestamp.
- Add proof-of-address submission through an approved provider or a protected evidence workflow.
- Location alone never proves residence; compare it with the address and identity policy.
- **Gate:** do not collect coordinates or address documents until the location/residence provider, retention period, reviewer access model and just-in-time privacy copy are approved.
- Didit evidence mapping is implemented for Proof of Address and Device/IP Analysis. The IP result is anti-fraud evidence only; it can never pass the live-location safeguard because an IP-derived coordinate is not consented GPS.
- Completed Didit decisions are now ingested idempotently into derived KYC stage records. Provider addresses, document links, IP addresses and coordinates are explicitly excluded from the stored evidence and audit metadata.
- Residence consent is persisted and shown after reload. If consent is recorded after a completed identity session, the API can re-fetch the authenticated Didit decision and recover only the redacted proof-of-address outcome; raw address data is never persisted. The stage stays unavailable until `KYC_RESIDENCE_ENABLED=true` explicitly confirms that the approved Didit workflow and privacy controls include Proof of Address.
- A browser-GPS-to-proof-of-address comparison is implemented behind `KYC_LOCATION_ENABLED=false`. It records separate location consent first, uses the submitted GPS and Didit PoA coordinates only in memory, then stores only the distance-threshold/accuracy outcome. It must remain disabled until the KYC privacy notice is formally approved for this data category and the workflow has Proof of Address plus Device/IP Analysis enabled.

### Phase 4 — financial KYC

- Select and contract a licensed provider for each market before connecting any bank/account data.
- Never collect bank passwords. Persist only the minimized ownership/identity-consistency outcome required for KYC policy and audit.
- **Gate:** a licensed provider and country-specific legal/compliance approval are required before enabling this stage.

### Phase 5 — review, retention and launch

- Non-identity KYC stages now create a generic review task whenever a derived result is `under_review`. `KYC_REVIEWER_EMAILS` plus mandatory reviewer 2FA protect the queue; decisions require an evidence reference and notes, update only the reviewed stage, and append an immutable audit event.
- The existing specialised identity/profile-photo review queue remains separate while its legacy data model is retained. It is shown alongside the KYC queue for the same authorised staff workflow.
- Next: add an appeals intake and retention/deletion jobs after legal retention periods are approved.
- Run sandbox, adverse-case, webhook replay, mobile and funded live-pilot tests before granting any Kinkord KYC badge.

## Working rules

- Didit remains the current identity/liveness provider until a documented provider scorecard changes that decision.
- Do not label an account KYC verified because a sandbox or a partial provider result approved.
- Any missing required evidence, uncertain result, provider review result, changed profile photo, location mismatch, address mismatch or financial mismatch must fail closed or route to authorised manual review according to the KYC policy.
- Any material change to consented data categories requires a new consent version and legal/privacy approval.

# Mono financial KYC provision (2026-09-22)

- Mono Connect is now the provisioned financial-stage provider. It is deliberately disabled by default and needs `MONO_FINANCIAL_KYC_ENABLED=true`, a server-only `MONO_SECRET_KEY`, `MONO_WEBHOOK_SECRET`, and `MONO_REDIRECT_URL` before it appears to members.
- The member is redirected to a Mono-hosted link. Kinkord never receives bank credentials, and does not persist Mono account IDs, account numbers, BVNs, balances, statements, transactions or raw financial identity fields.
- `POST /verification/kyc/financial/attempts` requires separately versioned financial consent. `POST /webhooks/mono` validates `mono-webhook-secret`, only accepts a Kinkord-issued reference, fetches the minimal identity response in memory, and stores derived pass/review flags only.
- An account link plus available Mono identity data must have date of birth and gender consistent with the attributes that already passed Kinkord's identity stage. Any unavailable data or mismatch becomes `under_review`, never a pass.
- Configure Mono dashboard webhook to `https://<api-host>/webhooks/mono`; use the exact generated webhook secret in `MONO_WEBHOOK_SECRET`. Configure Mono redirect URL to `https://<web-host>/settings/kyc`.
