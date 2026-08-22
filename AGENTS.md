<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

This file is the canonical engineering guidance for this repository.

If another repo doc disagrees with this file, follow `AGENTS.md`.

## Repo Snapshot

- Monorepo (pnpm workspaces + Turborepo): `apps/web` (Next.js site), `apps/api` (platform API), `packages/domain` (shared PMs), `infra/` (AWS CDK)
- App: Kinkord marketing site + admin (lectures), evolving into the full platform
- Platform: Next.js App Router (React) on AWS; API on AWS (no Vercel)
- Styling: Tailwind CSS
- Data: Google Sheets via repositories (legacy, migrating to Postgres); JWT cookie auth
- Main layers: views → presenters → services → repositories → domain
- Unqualified `src/` paths in this file refer to `apps/web/src/`

## Core Principles

### Dependency Direction

High-level policies must never depend on low-level details.

- Business logic and domain models are high-level
- UI components, API calls, and platform integrations are low-level
- Dependencies flow inward: UI → presenters → services → domain
- Use abstractions to invert dependencies when needed

### Single Responsibility

Each module should have one reason to change.

- Presenters orchestrate UI state and prepare view models
- Services hold business logic
- Components render UI
- Repositories handle data access

## Non-Negotiable Rules

- Views must be dumb. Keep business logic out of components.
- Only top-level screens in `src/app/` may call presenters.
- Reusable components in `src/components/` must not call presenters.
- Components must not call services or repositories.
- Components must not import from `constants/` for copy/data — receive display-ready props from the screen/presenter.
- Store domain models (PMs) in state and server data, not view models (VMs), when persisting or fetching.
- Presenters return VMs and display-ready props, not raw transport payloads.
- Business logic belongs in services, not presenters, components, or route handlers beyond wiring.
- Repositories return domain models, not raw API/sheet payloads.
- Use `Routes` constants instead of hardcoded internal path strings where navigation is shared.
- API route handlers may call repositories/services directly (they are the server boundary), not presenters.

## Layer Rules

### View Layer

Applies to `src/app/` and `src/components/`.

Always:

- Keep screens/components focused on rendering and user interaction
- Pass presenter output down as props
- Keep reusable components pure and predictable
- Use TypeScript props interfaces

Never:

- Call presenters from nested components
- Call services or repositories directly from components
- Fetch data directly in reusable components
- Perform business/data transformations in components

### Presenter Layer

Applies to `src/presenters/`.

Always:

- Client screens: custom hooks named `use*Presenter`
- Server screens: plain functions named `get*VM` / `prepare*` that return display-ready props
- Orchestrate services and map PMs → VMs
- Keep event handlers and loading/error UI state here for client flows

Never:

- Put core business rules in presenters (delegate to services)
- Put styling or layout markup in presenters
- Call repositories from presenters when a service should own the workflow (prefer services; thin CRUD screens may use repositories via services)

### Domain Layer

Applies to `src/domain/`.

Always:

- Treat PMs as the source of truth
- Implement `toVM()` when a domain model needs a presentation shape
- Keep invariants and core transforms here or in services

Never:

- Store VMs as the persisted/fetched source of truth
- Send VMs to APIs or sheets

### Service Layer

Applies to `src/services/`.

Always:

- Put calculations, validations, and domain rules here
- Keep services framework-agnostic where possible (no React hooks)

Never:

- Import React into services
- Reach into UI state from services

### Repository Layer

Applies to `src/repositories/`.

Always:

- Handle API/storage/sheet access here
- Return domain models or nullish values on failure
- Keep transport details isolated from higher layers

Never:

- Return raw transport payloads to callers
- Put business logic in repositories beyond mapping to/from domain models

## Project Conventions

### File Organization

```text
apps/
  web/            Next.js app (this tree is what `src/` refers to below)
    src/
      app/            Next.js routes (top-level screens + API handlers)
      components/     Dumb UI building blocks (sections, ui, admin views)
      presenters/     Presentation orchestration (hooks + get*VM)
      domain/         Domain models (PMs) and PM → VM transforms
      services/       Business logic
      repositories/   Data access (Sheets, auth credentials boundary)
      constants/      App constants and Routes
      util/           Pure utilities
  api/            Platform API (NestJS) — services/repositories mirror the same layering
packages/
  domain/         Shared domain models/contracts consumed by web + api
infra/            AWS CDK stacks (all infrastructure as code)
```

### Screens vs components

- `src/app/**/page.tsx` (and thin screen wrappers) wire presenters → dumb views
- `src/components/**` only render props and emit callbacks

### Styling

- Prefer Tailwind utility classes
- Keep brand tokens consistent with existing CSS variables / gold palette
- Avoid introducing new visual systems unless explicitly requested

## Testing Guidance

Always:

- Test business logic in services
- Test PM → VM transforms
- Mock repositories/external I/O in tests

Never:

- Make real Google Sheets or network calls in unit tests

## Common Anti-Patterns

- Presenter usage inside `src/components/`
- Business logic inside presenters or components
- Components importing `constants/` copy or `repositories/`
- Storing VMs as source-of-truth state
- Hardcoded internal route strings when `Routes` exists

## Quick Checklist

Before finishing a change, verify:

- Views are dumb
- Presenters are only used from top-level screens (`src/app/`)
- Business logic lives in services
- Repositories return domain models
- Navigation uses `Routes` where applicable
