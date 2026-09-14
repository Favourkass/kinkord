# OTP API

The web app exposes server-side OTP functions without changing the existing signup flow.

## Environment

Set these values in the deployment secret store or local ignored `.env` file:

```env
ROBASE_API_KEY=robe_...
OTP_SECRET=a-long-random-secret
RESEND_API_KEY=re_...
EMAIL_FROM=Kinkord <no-reply@kinkord.com>
```

`ROBASE_API_KEY` is used only for SMS OTP. Email OTP uses the existing Resend account. `OTP_SECRET` encrypts email challenges; `AUTH_SECRET` is used as a fallback when `OTP_SECRET` is omitted.

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