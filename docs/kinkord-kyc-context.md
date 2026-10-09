# Kinkord KYC — implementation continuity

## Product decision

Kinkord has one verification product: **Kinkord KYC**. Do not introduce Bronze, Gold, or tiered KYC labels in member-facing copy, routes, badges, policy pages, or staff interfaces.

The current Kinkord KYC release is awarded only after the approved policy verifies all active domains:

1. live biometric/liveness;
2. government ID and identity-detail match;
3. consented live-location evidence;
4. residence/proof-of-address evidence.

Financial/account verification is paused. The dormant Mono adapter is not displayed, cannot be
started through the member KYC API, and does not contribute to or block the KYC seal.

Profile-photo comparison is an anti-impersonation signal. It is not a substitute for government ID and must not silently become the sole KYC criterion.

## Phase status

### Phase 1 — naming, safety and continuity (completed)

- Introduced the `/settings/kyc`, `/settings/kyc/reviews`, and `/privacy/kyc` public routes.
- Preserve old verification paths as redirects, because audit records, bookmarks and provider return URLs may still reference them.
- Keep existing `bronze_*` database structures as **legacy identity-verification data**. Never automatically promote a legacy approved record to `Kinkord KYC Verified`: it lacks location and address checks.
- Official KYC seal: `/brand/kinkord-kyc-verified-badge-v1.png`. It is a transparent, isolated version of the user-supplied artwork. Use it only for a genuinely KYC-verified public state.

### Phase 2 — KYC domain and identity foundation (completed)

- Added KYC case, attempt, provider-session, derived-evidence, separate-consent and audit-event tables in migration `0010_cold_quicksilver.sql`, alongside legacy tables.
- Added a fail-closed KYC policy: the official seal requires passed identity, location and residence stages; the identity stage itself requires national/government ID, liveness, ID-face, profile-face and identity-detail checks.
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
- A browser-GPS-to-proof-of-address comparison records separate location consent first, uses submitted GPS and Didit PoA coordinates only in memory, then stores only the distance-threshold/accuracy outcome. Production configuration enables it only with the approved KYC privacy notice and a live Didit workflow containing Proof of Address plus Device/IP Analysis.

### Phase 4 — financial KYC

- The current release does not request or require bank/account verification.
- Select and contract a licensed provider for each market before reactivating any bank/account data flow.
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
- Any missing required evidence, uncertain result, provider review result, changed profile photo, location mismatch or address mismatch must fail closed or route to authorised manual review according to the KYC policy.
- Any material change to consented data categories requires a new consent version and legal/privacy approval.

# Dormant Mono financial KYC provision (paused 2026-10-09)

- Mono Connect code is retained for possible future use, but `MONO_FINANCIAL_KYC_ENABLED=false` is enforced in production infrastructure and no member start route is exposed by the active KYC controller.
- If this feature is reactivated later, its hosted-link flow must remain provider-owned; Kinkord must not receive bank credentials or persist account IDs, account numbers, BVNs, balances, statements, transactions or raw financial identity fields.
- The dormant Mono webhook implementation remains for future work, but the active member controller exposes no endpoint that can start a financial attempt.
- An account link plus available Mono identity data must have date of birth and gender consistent with the attributes that already passed Kinkord's identity stage. Any unavailable data or mismatch becomes `under_review`, never a pass.
- Configure Mono dashboard webhook to `https://<api-host>/webhooks/mono`; use the exact generated webhook secret in `MONO_WEBHOOK_SECRET`. Configure Mono redirect URL to `https://<web-host>/settings/kyc`.
