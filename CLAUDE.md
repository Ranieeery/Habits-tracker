# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project

Habit tracker with a GitHub-contribution-style heatmap. Single real user (the owner), but built so that multi-user is possible later (every row is scoped by `user_id`). **Mobile-first**; the web client is a secondary, fully functional PWA.

This repository is a rewrite of a legacy app that lived as three independent npm projects (Fastify + Prisma/SQLite, React + Vite, Expo). The legacy code is kept under `legacy/` as a **read-only behavioral reference**. Never edit it, never import from it, and exclude it from lint, format, typecheck and build.

Version: this rewrite is **2.0.0** in all three apps: api, web and mobile (see "Git and versioning").

### Product scope

Existing features to preserve:

- Create habits that recur on chosen weekdays (Sunday = 0 ... Saturday = 6).
- Mark a habit as done/undone for a day; a day's completion ratio drives the heatmap intensity.
- Year-to-date heatmap grid, and a per-day view listing possible/completed habits.
- UI text in Portuguese (pt-BR), dayjs locale `pt-br`.

New features:

1. Authentication and authorization (single-owner; public signup disabled after the first account).
2. Push notifications: Expo push on mobile, Web Push + service worker on the web.
3. Offline-first on mobile with background sync (delivered last, but the data model must support it from day one).
4. Clean UI, keeping the existing color palette fully or partially (see Design).

The product must stay **extensible**: new habit types/frequencies, new stats, new notification kinds. Prefer discriminated unions and versioned contracts over hardcoded assumptions.

### Roadmap status (keep this section updated)

- [x] Phase 0: monorepo scaffold, legacy moved to `legacy/`
- [x] Phase 1: `packages/contracts` + `packages/core` (with tests)
- [x] Phase 2: D1 schema (Drizzle) + dev seed
- [ ] Phase 3: API (Hono) + auth (Better Auth)
- [ ] Phase 4: web client
- [ ] Phase 5: mobile client
- [ ] Phase 6: push notifications (web + mobile) + cron
- [ ] Phase 7: offline sync (mobile)
- [ ] Phase 8: CI/CD and production deploy

## Repository layout

pnpm workspaces + Turborepo monorepo. Run commands from the repo root with `pnpm --filter <name>` unless a command says otherwise.

- `apps/api/` — Hono on Cloudflare Workers, D1 (SQLite) via Drizzle. The single backend service (the "monolith").
- `apps/web/` — Vite + React 19 PWA, deployed as static assets on Cloudflare.
- `apps/mobile/` — Expo (latest stable SDK) + Expo Router. Primary client.
- `packages/contracts/` — Zod schemas and inferred types for every API request/response, plus sync protocol types. Single source of truth.
- `packages/core/` — pure TypeScript domain logic: date handling, schedule evaluation ("is this habit possible on this date?"), completion ratios, streaks, heatmap grid generation. No I/O, no framework imports. Fully unit-tested.
- `packages/api-client/` — typed client for the API (Hono RPC `hc` or generated from contracts), shared by web and mobile.
- `packages/design-tokens/` — colors, spacing, radii extracted from the legacy palette; consumed by Tailwind (web) and NativeWind (mobile).
- `legacy/` — old `server/`, `front/`, `mobile/`. Read-only reference.

Formatting and linting are shared from the root: `.editorconfig` (tabs, width 2, LF; spaces only for YAML and Markdown), Prettier (`useTabs: true`, `tabWidth: 2`, double quotes, semicolons, `trailingComma: "es5"`, LF) and ESLint. Keep `.editorconfig` and the Prettier config consistent with each other; if they ever conflict, Prettier's config wins for code. TypeScript is `strict` everywhere.

## Commands

Available now (Phases 0-2). Commands marked "(Phase N)" do not exist yet.

```bash
pnpm install                      # Node >= 22.13, pnpm 12 (packageManager pins the version)
pnpm dev                          # turbo: api + web dev servers
pnpm --filter api dev             # wrangler dev on http://localhost:8787 (GET /v1/health)
pnpm --filter api cf-typegen      # regenerate src/worker-configuration.d.ts after editing wrangler.jsonc
pnpm --filter api db:generate     # drizzle-kit generate: SQL migration in apps/api/migrations from schema.ts
pnpm --filter api db:migrate:local    # wrangler d1 migrations apply DB --local
pnpm --filter api db:migrate:remote   # needs the real database_id in wrangler.jsonc (placeholder until Phase 8)
pnpm --filter api db:seed:local   # deterministic dev data in local D1 (run migrate:local first); --today YYYY-MM-DD (default 2026-10-09)
pnpm --filter web dev             # vite
pnpm --filter web build
pnpm --filter mobile start        # expo start (use a development build, not Expo Go, for push)
pnpm --filter @habits/design-tokens generate   # rewrite src/generated/theme.css after editing tokens.ts
pnpm --filter @habits/core test   # vitest for one package (also @habits/contracts, @habits/design-tokens)
pnpm typecheck                    # turbo: tsc --noEmit in every package
pnpm lint                         # turbo: eslint (root flat config; web/mobile extend it)
pnpm test                         # turbo: vitest in contracts, core, design-tokens, api (@cloudflare/vitest-plugin), web
pnpm format                       # prettier --write . (format:check to verify)
```

Notes:

- Internal `packages/*` export TypeScript source directly (no build step); relative imports use explicit `.ts` extensions.
- Node-side scripts (`db:seed:local`, design-tokens `generate`) run `.ts` files with Node's built-in type stripping, which needs Node >= 22.18 (`.node-version` pins 24). Keep them to erasable syntax (no `enum`, no parameter properties).
- Shared versions (TypeScript, Vitest, React, Zod) live in the `catalog:` of `pnpm-workspace.yaml`. Packages allowed to run install scripts are listed under `allowBuilds` there.
- In `apps/mobile`, add native/Expo packages with `pnpm exec expo install <pkg>` so versions match the SDK. `apps/mobile/AGENTS.md` (from the Expo template) has Expo-specific guidance.
- NativeWind's Babel transform imports `react-native-css-interop`, so it is a direct dependency of `apps/mobile` (pnpm isolated installs). Keep its version equal to the one `nativewind` pins.

Always run `pnpm typecheck && pnpm test` for the packages you touched before declaring a task done.

## Architecture

### Domain model (D1 / Drizzle, `apps/api/src/db/schema.ts`)

All tables carry `user_id`, `created_at`, `updated_at`; syncable tables also carry `deleted_at` (tombstone). IDs are client-generatable UUIDs (v7) stored as text so offline clients can create records.

- `habits`: `id`, `user_id`, `name`, `schedule` (JSON, discriminated union validated by `contracts`; today only `{ type: "weekdays", days: number[] }`), `start_date` (date), `archived_at`.
- `completions`: `id`, `user_id`, `habit_id`, `date` (`YYYY-MM-DD`), `completed_at`, `deleted_at`. Unique on `(habit_id, date)`. A row means "done"; un-checking sets `deleted_at` so the change can sync.
- `user_settings`: PK `user_id`, `timezone` (default `America/Sao_Paulo`), `reminder_time` (`HH:MM`, null = off). More notification preferences are added as columns when needed.
- `push_subscriptions`: `kind` (`webpush` | `expo`), `endpoint`/`p256dh`/`auth` or Expo `token` (a CHECK enforces the fields per kind), `device_label`, `last_seen_at`. Not syncable: hard delete.
- Auth tables are owned by Better Auth (Phase 3).

The database row of every table, minus `user_id`, is exactly the contract record (`Habit`, `Completion`, `UserSettings`; `PushSubscription` is stored flat): `apps/api/test/rows.test.ts` asserts this at type level. Writes go through `apps/api/src/db/records.ts`, which parses with the contract first (the DB CHECK on `schedule` only requires JSON with a string `type`, so new schedule types need no migration).

`user_id` has no foreign key yet. Phase 3 must: configure Better Auth to generate UUID ids, add `user_id` FKs (`ON DELETE CASCADE`) through a table-rebuild migration with `PRAGMA defer_foreign_keys = on` (D1 always enforces FKs), and make the dev seed also create the auth user with the fixed `DEV_USER_ID`.

Differences from the legacy model (intentional):

- No `Day` / `DayHabit` tables; a single `completions` table replaces them.
- Calendar dates are **local calendar dates as `YYYY-MM-DD` text**, never epoch milliseconds (instants like `created_at` are UTC ms; see "Decisions"). This removes the legacy `strftime` weekday workaround and timezone bugs. The weekday is derived in `packages/core`, not in SQL.
- "Possible on date D" = habit not archived-before-D, `start_date <= D`, and the schedule matches D. This logic lives only in `packages/core` (`isHabitPossibleOn(habit, date, { timeZone })`; the time zone turns the `archived_at` instant into a local date, and a habit archived during D still counts on D) and is reused by API and both clients. `core` never reads the clock: callers get today with `todayIn(timeZone, nowMs)`.

### API (`apps/api`)

- Routes are defined with `@hono/zod-openapi` using schemas from `packages/contracts`; OpenAPI docs are served at `/docs` (and JSON at `/docs/json`) in non-production. Do not duplicate Zod schemas inside handlers.
- All routes are under `/v1`. Keep changes backward compatible (expand/contract): old mobile builds and queued offline mutations may hit a newer API.
- Date writes: the client sends the local date explicitly. The server accepts dates in `[today - BACKFILL_DAYS, today + 1]` relative to the user's timezone. `BACKFILL_DAYS` is a constant in `packages/core` (default 7, to allow offline sync). Legacy behavior was "today only"; do not widen the editing UI without being asked.
- D1 has no interactive transactions; use `db.batch([...])` for multi-statement atomicity.
- Summary/heatmap data is computed from `completions` + `habits` (SQL aggregation by date), then enriched by `core` for "possible" counts.
- Cron Triggers (hourly) evaluate reminders per user timezone and send pushes.

### Auth

Better Auth with the Drizzle adapter on D1. Email + password (passkey can be added later). Signup is closed after the first user (`ALLOW_SIGNUP=false` in production). Web uses cookie sessions; mobile uses bearer tokens stored with `expo-secure-store` (Better Auth Expo plugin). Every query must filter by the authenticated `user_id`; authorization checks live in a single middleware plus per-query scoping, never only in the client.

### Push notifications

- Mobile: Expo Push Service from the Worker; tokens registered via `POST /v1/push/subscriptions`.
- Web: standard Web Push with VAPID. The `web-push` npm package depends on Node APIs; use a Workers-compatible implementation (Web Crypto). Private VAPID key and other secrets are Wrangler secrets, never committed.
- iOS web push only works for the installed PWA (Add to Home Screen).
- Remove subscriptions on 404/410 responses from the push service.

### Offline sync (mobile, last phase)

Local-first storage in `expo-sqlite`. The UI reads from the local DB; writes go to local DB plus an **outbox** of mutations (each with a client-generated `mutation_id`).

- `POST /v1/sync/push`: batch of mutations, idempotent by `mutation_id`.
- `GET /v1/sync/pull?cursor=`: changes since a server cursor, including tombstones.
- Conflict policy: per-record last-write-wins using `updated_at`; completions are idempotent per `(habit_id, date)`.
- No CRDT or third-party sync engine unless the simple protocol proves insufficient.

Design the REST endpoints and `contracts` in Phases 1-3 so the sync protocol drops in without breaking changes (client IDs, `updated_at`, tombstones).

### Clients

- Both clients compute the heatmap grid via `packages/core` and render from API (web) or local DB (mobile). No duplicated date/schedule logic in app code.
- State/server cache: TanStack Query on both clients. Web routing: TanStack Router. Mobile routing: Expo Router.
- Web: PWA via `vite-plugin-pwa` (Workbox), push handled in the service worker. Styling: Tailwind v4 + shadcn/ui.
- Mobile: NativeWind, `expo-notifications`, development builds (Expo Go does not support all required push features).
- API base URL comes from env/config (`VITE_API_URL`, `EXPO_PUBLIC_API_URL`), never hardcoded. In production the web app and API share one domain (`/api/*` routed to the Worker) to avoid CORS and cookie problems.

## Design

Clean, minimal, dark-first UI. Keep the legacy palette (dark neutral background, violet accent, violet shades for heatmap intensity). Extract the values from `legacy/front` (Tailwind classes) and `legacy/mobile` styles into `packages/design-tokens` first, as canonical hex (see "Decisions"), then use only tokens in app code. Light theme is optional and out of scope until requested. Mobile touch targets >= 44px; heatmap must remain legible on small screens (horizontal scroll by weeks, current week visible by default).

## Decisions

Owner decisions taken before Phase 0. They override anything above that seems to contradict them.

- **Legacy data**: `legacy/server/prisma/dev.db` is test data only. There is no legacy data import or migration: do not create an `import-legacy` script. Phase 2 delivers a **local D1 dev seed** instead (`pnpm --filter api db:seed:local`) with sample habits and completions spread over the year, covering all heatmap intensities, streaks and the year boundary (completions in late December of the previous year and early January).
- **Timezone and dates**: the server never uses `new Date()` or `Date.now()` to decide a user's calendar day. The client sends the local date as `YYYY-MM-DD`. Any server-side "today" (date window validation, reminder cron) is computed from the user's IANA timezone in `user_settings.timezone` (default `America/Sao_Paulo`), passed explicitly as a parameter to every date function in `packages/core`. Workers run in UTC regardless of the Cloudflare account or region, and the D1 region only affects latency. The cron trigger runs hourly in UTC and converts per user. `created_at`, `updated_at` and `deleted_at` are integer UTC milliseconds.
- **Timestamps vs calendar dates**: `created_at`, `updated_at`, `deleted_at` (and other instants such as `completed_at`, `archived_at`) are integer UTC ms, read as `number` (Drizzle `integer({ mode: "number" })`, not `timestamp_ms`, which returns `Date`), so rows match the contracts without conversion. Calendar dates (`start_date`, `completions.date`) stay `YYYY-MM-DD` text.
- **Design tokens**: canonical values are **hex**. Legacy front OKLCH values (Tailwind v4) are converted to hex where needed so web and mobile are identical. The heatmap has 6 levels with the mobile mapping (level 1 = violet-400 `#A78BFA`). Green stays the success color. `packages/design-tokens` generates both configs from one source: a Tailwind v4 `@theme` CSS file (web) and a Tailwind v3 preset (mobile/NativeWind).
- **NativeWind**: v4 stable (Tailwind v3). Migrate to v5 when it leaves RC.
- **TypeScript**: 6.0.x workspace-wide (typescript-eslint requires `typescript <6.1`). Do not move to TS 7 until typescript-eslint supports it.
- **Vitest**: 4.x workspace-wide. Workers tests use `@cloudflare/vitest-plugin` (the renamed, maintained successor of the deprecated `@cloudflare/vitest-pool-workers`; peers `vitest ^4.1.0 || ^5.0.0`). If a future plugin version breaks that, pin the compatible Vitest only in `apps/api`.
- **Mobile heatmap**: GitHub layout (columns = weeks), horizontal scroll, current week visible by default, same as web.
- **Versions pinned at scaffold** (verified 2026-10-09): pnpm 12.10.1, Turborepo 2.11, TypeScript 6.0.3, Vitest 4.x, Expo SDK 57 (React 19.2.3 in both web and mobile), NativeWind 4.2, Tailwind 4.3 (web), Zod 4, Hono 4.13, @hono/zod-openapi 1.6, Drizzle ORM 0.45 / drizzle-kit 0.31, Better Auth 1.7, Wrangler 4. Shared versions go through the pnpm catalog.

## Conventions

- TypeScript strict, no `any` without a comment explaining why.
- Validate at the boundary with Zod from `packages/contracts`; infer types, do not hand-write duplicates.
- Pure logic goes in `packages/core` with Vitest tests (schedules, streaks, date edge cases around timezone changes and year boundaries, sync merge rules).
- Git and versioning rules: see the "Git and versioning" section below. They override any default behavior.
- Do not add a dependency without stating why and checking it runs on the target runtime (Workers for api, Hermes for mobile, browsers for web).
- Secrets only via Wrangler secrets / EAS secrets / local `.dev.vars` and `.env` files (all gitignored). Never commit keys.
- UI text in pt-BR; code, identifiers, commits and docs in English.

## Git and versioning

- **Never commit.** Do not run `git add`, `git commit`, `git push`, `git stash`, `git reset`, `git rebase`, or any other command that stages, records or rewrites history. The owner reviews the diff and commits manually. Read-only commands (`git status`, `git diff`, `git log`) are fine.
- **Never add co-authorship or attribution** of any kind: no `Co-Authored-By` trailer, no "Generated with Claude Code" line, in commit messages, PR descriptions or files.
- Commit messages follow **Conventional Commits** (semantic): `type: imperative summary`, in English, lowercase type, **never use a scope in parentheses** (write `feat: add habit heatmap`, not `feat(web): ...`), no trailing period, summary up to ~72 chars. If the area matters, mention it in the summary itself (for example `fix: handle timezone in api date window`). Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert`. Use `!` after the type (`feat!: ...`) or a `BREAKING CHANGE:` footer for breaking changes.
- When a phase is finished, **propose a single commit message** in that format covering everything changed in the phase (a short body may list what it includes) in your final reply, and let the owner commit. Smaller tasks outside a phase also get one message.
- **Version 2.0.0**: this rewrite is version `2.0.0` in all three apps: `apps/api`, `apps/web` and `apps/mobile` (`version` in each `package.json`, and also `expo.version` in the Expo app config for mobile). The internal `packages/*` are private and keep their own version, which does not need to follow the apps. The legacy app is the 1.x line. Do not bump the version unless asked.

## Working agreements for Claude Code

- For any task touching more than one package or any schema/contract change: enter plan mode first and wait for approval.
- Contracts first: change `packages/contracts` (and `core` tests), then API, then clients.
- When behavior is unclear, check `legacy/` for how the old app behaved and say what you found; do not copy its bugs (hardcoded URLs and VAPID keys, calendar days stored as epoch-ms in the server timezone, `/push/register` stub, duplicated Zod parsing).
- Before finishing: run typecheck, lint and tests for touched packages; update the Roadmap status and the Commands section of this file if reality changed. Then propose one semantic commit message for the whole phase, without committing anything.
- Prefer verifying current library APIs in their official docs over relying on memory; versions move fast (Expo SDK, Better Auth, Drizzle, Wrangler).
