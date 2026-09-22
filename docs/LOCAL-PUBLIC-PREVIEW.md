# Temporary public preview from a developer machine

This is for a small group of trusted testers **before** a dev/prod deployment. It is not a production hosting setup. The public URL and password last only while their processes run; the URL changes after a restart. Do not submit real IDs or biometric images to the Didit sandbox.

Prerequisites: Docker Desktop, Node/pnpm, and `cloudflared` installed on the host. Do not forward router ports or expose Postgres, Mailpit, or MinIO directly. `docker-compose.yml` binds those services to `127.0.0.1`.

From the repository root, run these in separate PowerShell terminals:

```powershell
docker compose up -d
corepack pnpm --filter api db:migrate
corepack pnpm --filter api dev
```

```powershell
$env:NEXT_PUBLIC_API_URL = "/__api"
$env:LOCAL_PREVIEW_PROXY = '1'
corepack pnpm --filter web build
corepack pnpm --filter web start
```

Use the optimized build for the tunnel. The Next.js development/HMR client is not reliable through a Cloudflare Quick Tunnel and can leave the entry splash mounted even after its video finishes.

```powershell
$env:PREVIEW_PUBLIC = "1"
node scripts/local-public-preview.mjs
```

The preview proxy listens only on `127.0.0.1:3100` and proxies the web app, API and signed MinIO media through one browser origin. `PREVIEW_PUBLIC=1` removes the preview-level password so designated testers reach Kinkord directly; Kinkord's normal login still protects member routes. Omit that variable to use the generated preview password. Start the temporary HTTPS tunnel in another terminal:

```powershell
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://127.0.0.1:3100
```

Share the printed `https://*.trycloudflare.com` URL only with designated testers. They still need a Kinkord test account. Do **not** share Mailpit, MinIO console, database credentials, or real member credentials. Stop the tunnel and preview proxy to revoke public access; stopping the web/API processes ends the local app.

The local Didit application must stay in sandbox mode. Bronze remains gated until the biometric/ID notice, retention schedule, and reviewer access are approved; `BRONZE_POLICY_URL` must not be set to the draft notice merely to open this public preview. The temporary URL is unsuitable as a stable Didit webhook or production return URL. A signed-off, access-controlled staging deployment is needed for a full real-data verification test.
