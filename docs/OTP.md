# Phone verification (OTP)

Proving a phone number is what earns the **Basic verified** badge
(`profile.phone_verified`). Two screens use it: signup step 3, and Settings →
Security for anyone who skipped it at the time. Both drive the same presenter
hook (`usePhoneVerification`), so the cooldown, attempt wording and error
handling are written once.

## Endpoints

Both require a session; both live under `/profile/phone` because the number
always comes from the caller's own profile.

### `POST /profile/phone/send-code`

No body. Reads the number from the signed-in member's profile and texts a
6-digit code through the usual `SmsService` (Robase, which routes per country).

```json
{
  "otpId": "0f1c…",
  "sentTo": "+234******3266",
  "expiresAt": "2026-09-15T13:20:00.000Z",
  "resendAfterMs": 60000
}
```

Refuses with 400 when the profile has no number or it is already verified, and
429 for the cooldown or hourly cap.

### `POST /profile/phone/verify`

```json
{ "otpId": "0f1c…", "code": "123456" }
```

Returns `{ "verified": true, "attemptsLeft": null }` on success, which also sets
`profile.phone_verified`. A wrong code returns `verified: false` with the
attempts remaining; the third wrong code returns 429 and locks the challenge for
24 hours.

## Why there is no endpoint that takes a destination

An endpoint that texts an arbitrary number is an open SMS relay: anyone could
run up the SMS bill from a script. The destination is therefore never read
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
