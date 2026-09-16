# Kinkord — Local Development Onboarding

Everything you need to run the full stack (web + API + database + email) on your machine.

## Prerequisites

| Tool | Version | Install (macOS) |
|---|---|---|
| Node.js | 22+ | `brew install node@22` or nvm |
| pnpm | 11 (pinned) | `npm i -g pnpm@11` |
| Docker | any recent | Docker Desktop, or `brew install colima docker docker-compose && colima start` |
| Git | any | — |

> Colima note: if image pulls fail with DNS timeouts, run
> `colima ssh -- sudo sh -c 'printf "nameserver 8.8.8.8\noptions use-vc\n" > /etc/resolv.conf'`

## First run

```bash
git clone https://github.com/Favourkass/kinkord.git
cd kinkord
pnpm install

# Local Postgres 17 + Mailpit (catches all emails locally)
docker compose up -d

# API environment
cp apps/api/.env.example apps/api/.env
# then edit apps/api/.env: set AUTH_SECRET to any long random string
#   openssl rand -hex 32

# Web environment
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > apps/web/.env.local

# Database schema
pnpm --filter api db:migrate

# Run everything (two terminals, or use turbo)
pnpm --filter api dev     # API on :4000
pnpm --filter web dev     # Web on :3000
```

Open http://localhost:3000/signup and create an account. **All emails land in
Mailpit at http://localhost:8025** — verification codes, password resets, etc.
Nothing is sent to real inboxes locally.

## What works locally without any cloud credentials

- Full signup wizard, login, 2FA (scan the QR with Google Authenticator), password recovery
- Profile viewing/editing
- All emails (via Mailpit)
- **Both verification flows, end to end** — see below

**Avatar/cover uploads** are the one feature that talks to real AWS S3 (presigned
uploads). Without AWS credentials they fail gracefully. If you need them, ask
Favour for a scoped IAM user (S3-only) and run `aws configure`.

## Testing the verification flow

Neither channel needs a provider account locally.

| Channel | Where the code appears |
|---|---|
| Email | Mailpit — http://localhost:8025 |
| SMS | The API log, as `[local sms] to +234…: Your Kinkord verification code is …` |

With `ROBASE_API_KEY` unset the API prints the text message instead of sending
it, the same way Mailpit catches email. That path is refused when
`NODE_ENV=production`, so a deployed API missing its key fails loudly rather
than telling members a code is coming and sending nothing.

Walk the whole thing without leaving your machine:

1. Sign up at http://localhost:3000/signup. Step 3 emails a code on arrival —
   read it in Mailpit and enter it.
2. Press **Text me a code** on the same screen and read the code out of the
   terminal running the API.
3. Both again later from **Settings → Security**, which is where members verify
   if they skipped at signup.

Codes expire in 10 minutes, a resend is refused for 60 seconds, and three wrong
codes lock that challenge for 24 hours — all of which you will hit while
testing. `docs/OTP.md` has the full rules.

## Changing the database schema

Drizzle owns the schema; never hand-write SQL in `apps/api/drizzle/`.

```bash
# after editing apps/api/src/db/schema/*.ts
pnpm --filter api db:generate   # writes the next NNNN_*.sql + snapshot
pnpm --filter api db:migrate    # applies it to your local database
```

Commit the generated SQL **and** the meta files with your change. A schema PR
without its migration looks fine in review and then fails every request in a
deployed environment, because the table it describes was never created.

## Quality gates (CI enforces all of these — run them before pushing)

```bash
pnpm exec prettier --check .   # or --write
pnpm run lint                  # strict: unused imports are errors; layering walls
pnpm run typecheck
pnpm run test                  # unit tests (api + web)
node scripts/check-tests.mjs   # changed feature files must have .spec files
```

## Workflow rules (machine-enforced, no exceptions)

1. **Never commit to `dev` or `main` directly** — pushes are rejected by GitHub.
2. Branch from `dev` → PR into `dev` → CI must pass → merge.
3. `main` only accepts PRs **from `dev`** (deploys production).
4. Architecture rules live in [`AGENTS.md`](../AGENTS.md) and are enforced by
   ESLint: components stay dumb, presenters orchestrate, services own logic.
   The linter will reject imports that skip layers.
5. Every changed feature file needs a colocated `.spec.ts` — CI fails otherwise.

## Repo map

```
apps/web    Next.js PWA (views → presenters → services per AGENTS.md)
apps/api    NestJS API (Better Auth, Drizzle ORM, Postgres)
packages/   Shared domain contracts (growing)
infra/      AWS CDK — all infrastructure as code
scripts/    CI helpers
design/     Figma pulls (reference only, not committed assets)
```
