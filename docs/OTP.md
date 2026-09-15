# OTP API

The NestJS API owns OTP generation, delivery, persistence, and verification. The web app only proxies these public routes and must not contain provider credentials.

## Environment

Set these values in the deployment secret store or local ignored `.env` file:

```env
OTP_SECRET=a-long-random-secret
RESEND_API_KEY=re_...
EMAIL_FROM=Kinkord <no-reply@kinkord.com>
```

Email OTP uses the existing Resend account. `OTP_SECRET` hashes email and SMS codes; `AUTH_SECRET` is used as a fallback when `OTP_SECRET` is omitted. The API database must contain the expected OTP challenge table before serving OTP requests.

After three failed code attempts, the challenge is locked for 24 hours. Sends are also limited to one per destination per minute, five per destination per hour, and ten per client IP per hour.

## Database expectation

The API expects a table named `otp_challenge`. This documentation describes the required shape only; database provisioning and migrations are managed separately.

| Column | Expected type | Required behavior |
| --- | --- | --- |
| `id` | text | Primary key; generated uniquely for each challenge |
| `channel` | text | `email` or `sms` |
| `destination` | text | Normalized email address or E.164 phone number |
| `code_hash` | text | SHA-256 hash of the OTP code with the configured secret |
| `expires_at` | timestamp | Challenge expiry time, normally 10 minutes after creation |
| `failed_attempts` | integer | Required; default `0`; incremented for each incorrect code |
| `locked_until` | timestamp, nullable | Set 24 hours into the future after the third failed attempt |
| `created_at` | timestamp | Required; defaults to the creation time |

The table should support lookups by `destination` and recent `created_at` values for send throttling. Verification also requires row-level locking while failed-attempt counters are updated.

## Send a code

`POST /api/otp/send`

```json
{ "channel": "sms", "destination": "+2348012345678" }
```

or:

```json
{ "channel": "email", "destination": "member@example.com" }
```

The response contains an `id`, `channel`, and `expiresAt`. Keep the `id` on the client and do not log it.

## Verify a code

`POST /api/otp/verify`

```json
{ "channel": "sms", "otp_id": "returned-id", "code": "123456" }
```

Email verification uses the same request shape. A valid response is `{ "valid": true }`; an incorrect or expired code returns `{ "valid": false }` with status `422`.

Example client call:

```ts
const sent = await fetch("/api/otp/send", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ channel: "sms", destination: "+2348012345678" }),
}).then((response) => response.json());

const verification = await fetch("/api/otp/verify", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ channel: "sms", otp_id: sent.id, code: "123456" }),
}).then((response) => response.json());
```