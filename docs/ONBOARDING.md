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

## Notifications inbox

The member inbox at `/notifications` stores activity independently of browser
push permission. Opening an item marks it read before navigating; the bell dot
stays visible while any unread items remain. Read state is stored per member,
shared across devices. The reference layout has All, Comments and Mentions tabs.
The search button opens search, the Unread filter, refresh and “Mark all as read”.
Row menus also let members mark individual items read without navigating.
Category filtering happens before pagination in the inbox API. Actor names and
avatar keys are captured with the event; the API signs small avatar URLs for the
inbox only, and device pushes keep their discreet text-only payload.

Mentions has an empty state until a mention producer is implemented; the tab
and API support filtering that event type, but current posting does not emit it.

| Event | Recipient | Opens |
|---|---|---|
| New message (text or photo) | Other conversation member | Conversation |
| New follow | Followed member | Follower’s profile |
| Comment | Post author, except their own comments | Post |
| Like | Post author, except their own likes | Post |
| Repost | Original post author, except their own reposts | Original post |
| Member report | Moderators | Report queue |
| Push test | Member enabling push | Settings |

Repeated follow/like/repost requests that do not insert a new activity do not
create another notification. Saved posts remain private and generate no alert.
Verification codes and password-reset emails remain separate from this inbox.
Earlier pushes were not stored, so history begins after the inbox migration.

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
