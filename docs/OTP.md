# Verification codes (OTP)

Two contact points are proved the same way, with a 6-digit code:

- **Email** (`user.email_verified`) — replaced Better Auth's click-a-link
  message on 2026-09-15, so members stay in the app instead of leaving for a
  mail client and back. `sendOnSignUp` is off; the link handler stays wired only
  for messages already sitting in inboxes.
- **Phone** (`profile.phone_verified`) — earns the **Basic verified** badge.

Signup presents the channels as separate wizard steps, while Settings →
Security can use either channel independently. Everything shares one service
(`OtpService`) and one presenter hook (`useVerification`), so the cooldown,
attempt wording and error handling are written once.

## Signup flow

The signup wizard has five progress steps:

1. Country selection
2. Account and profile details
3. Email verification
4. Phone/SMS verification
5. Profile setup

The account form submits to `POST /auth-ext/sign-up`. That endpoint creates the
account and writes the about-fields atomically. On success, the web presenter
enters the email stage and automatically calls the email send-code endpoint.

Email and phone verification are intentionally separate stages:

- Step 3 renders the email destination, six-digit code input, verification
  action, and resend control.
- A successful email verification does not advance automatically. The member
  clicks `Next step`, which moves the presenter to Step 4.
- Step 4 renders the phone number, SMS code input, resend control, and phone
  verification action.
- A successful phone verification advances to Step 5. `Skip for now` also
  advances to the profile stage without marking the phone verified.

The frontend ownership is split by layer:

- `apps/web/src/app/signup/page.tsx` renders the active step.
- `apps/web/src/presenters/useSignupWizardPresenter.ts` owns wizard stages and
  transitions.
- `apps/web/src/presenters/useVerification.ts` owns shared OTP state and
  actions.
- `apps/web/src/services/verification.service.ts` owns the API calls.

The temporary local review bypass used while designing the screens has been
removed. Production signup performs the real account request and OTP requests.

## Endpoints

All four require a session. The destination always comes from the caller's own
account, never from the request.

- `POST /profile/phone/send-code` · `POST /profile/phone/verify`
- `POST /profile/email/send-code` · `POST /profile/email/verify`

### `POST /profile/{channel}/send-code`

No body. Reads the number or address from the signed-in member's own record and
sends a 6-digit code — SMS through `SmsService` (Robase, which routes per
country), email through `EmailService` (Resend).

```json
{
  "otpId": "0f1c…",
  "sentTo": "+234******3266",
  "expiresAt": "2026-09-15T13:20:00.000Z",
  "resendAfterMs": 60000
}
```

Refuses with 400 when there is no number on the profile, or when that contact
point is already verified, and 429 for the cooldown or hourly cap.

### `POST /profile/{channel}/verify`

```json
{ "otpId": "0f1c…", "code": "123456" }
```

Returns `{ "verified": true, "attemptsLeft": null }` on success, which also sets
`profile.phone_verified` or `user.email_verified`. A wrong code returns `verified: false` with the
attempts remaining; the third wrong code returns 429 and locks the challenge for
24 hours.

## Why there is no endpoint that takes a destination

An endpoint that texts an arbitrary number is an open SMS relay: anyone could
run up the SMS bill from a script. The same shape for email would be a free way
to send mail from our domain to anyone. The destination is therefore never read
from the request.

## Rules

| Rule | Value |
| --- | --- |
| Code lifetime | 10 minutes |
| Resend cooldown | 60 seconds |
| Codes per hour | 5, counted per member **and** per destination |
| Wrong codes before lockout | 3 |
| Lockout | 24 hours |

Both rate limits are read from `otp_challenge`, so they hold across instances
and survive a restart. A per-IP limit would do neither, and behind App Runner
every request arrives from the same proxy address, so one would throttle
everybody at once.

## Storage

`otp_challenge` keeps a salted SHA-256 hash, never the code. The salt is
`OTP_SECRET` (falling back to `AUTH_SECRET`); issuing fails loudly if neither is
set, rather than silently using a default that would make the hashes
reversible. Rows are written before the code is sent, deleted if delivery
fails, deleted on success, and swept after 24 hours.

Changing the number on a profile resets `phone_verified`.

Both channels share the `otp_challenge` table and every limit above, so the
hourly cap counts a member's codes across email and SMS together.
