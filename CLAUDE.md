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
- [x] Phase 3: API (Hono) + auth (Better Auth)
- [x] Phase 4: web client
- [x] Minimal production deploy on workers.dev, manual (2026-10-10, https://habits.rxniery.workers.dev; owner created, signup closed; CI/CD stays in Phase 8)
  - [ ] Keep production CPU under the Free plan's 10 ms: build Better Auth once per isolate instead of per request (`createAuth` in `src/auth/auth.ts`), re-measure with `wrangler tail habits-api --format json`; otherwise move to Workers Paid
- [ ] Phase 5: mobile client
- [ ] Phase 6: push notifications (web + mobile) + cron
- [ ] Phase 7: offline sync (mobile)
- [ ] Phase 8: CI/CD and production deploy
  - [x] After the first deploy, measure the password hash time (sign-up/sign-in CPU) in production against the free plan limit. Measured 2026-10-10 (`wrangler tail`, `cpuTime` ms): sign-up 76, sign-in 25, get-session 13-51, settings/summary 12, habits 5-6, unauthenticated 401 3-44, health 1-12. All `outcome: ok` (nothing cut off yet), but many requests exceed 10 ms, mostly on cold isolates and Better Auth setup, not only the hash

## Repository layout

pnpm workspaces + Turborepo monorepo. Run commands from the repo root with `pnpm --filter <name>` unless a command says otherwise.

- `apps/api/` — Hono on Cloudflare Workers, D1 (SQLite) via Drizzle. The single backend service (the "monolith").
- `apps/web/` — Vite + React 19 PWA, deployed as the public Worker `habits` (static assets + `/api` gateway to the API).
- `apps/mobile/` — Expo (latest stable SDK) + Expo Router. Primary client.
- `packages/contracts/` — Zod schemas and inferred types for every API request/response, plus sync protocol types. Single source of truth.
- `packages/core/` — pure TypeScript domain logic: date handling, schedule evaluation ("is this habit possible on this date?"), completion ratios, streaks, heatmap grid generation. No I/O, no framework imports. Fully unit-tested.
- `packages/api-client/` — typed client for the API (Hono RPC `hc` over the `AppType` declarations emitted by `apps/api`), shared by web and mobile.
- `packages/design-tokens/` — colors, spacing, radii extracted from the legacy palette; consumed by Tailwind (web) and NativeWind (mobile).
- `legacy/` — old `server/`, `front/`, `mobile/`. Read-only reference.

Formatting and linting are shared from the root: `.editorconfig` (tabs, width 2, LF; spaces only for YAML and Markdown), Prettier (`useTabs: true`, `tabWidth: 2`, double quotes, semicolons, `trailingComma: "es5"`, LF) and ESLint. Keep `.editorconfig` and the Prettier config consistent with each other; if they ever conflict, Prettier's config wins for code. TypeScript is `strict` everywhere.

## Commands

Available now (Phases 0-4). Commands marked "(Phase N)" do not exist yet.

```bash
pnpm install                      # Node >= 22.13, pnpm 12 (packageManager pins the version)
pnpm dev                          # turbo: api + web dev servers
cp apps/api/.dev.vars.example apps/api/.dev.vars   # once: local config; set BETTER_AUTH_SECRET (command in the file)
pnpm --filter api dev             # wrangler dev on http://localhost:8787 (GET /v1/health, docs at /v1/docs)
pnpm --filter api cf-typegen      # regenerate src/worker-configuration.d.ts after editing wrangler.jsonc
pnpm --filter api db:generate     # drizzle-kit generate: SQL migration in apps/api/migrations from schema.ts
pnpm --filter api db:migrate:local    # wrangler d1 migrations apply DB --local
pnpm --filter api db:migrate:remote   # apply migrations to the production D1 (run before deploying a schema change)
pnpm --filter api run deploy      # deploy the private API Worker (habits-api); deploy it before the web when both change
pnpm --filter api db:seed:local   # deterministic dev data in local D1 (run migrate:local first); --today YYYY-MM-DD (default 2026-10-09)
                                  # also creates the auth user DEV_USER_ID: sign in as dev@habits.local / habits-dev-password
pnpm --filter api auth:generate   # regenerate src/db/auth-schema.ts with the Better Auth CLI after changing src/auth/options.ts, then db:generate
pnpm --filter api build:types     # emit the AppType declarations (dist/types) used by @habits/api-client; turbo runs it before typecheck
cp apps/web/.env.example apps/web/.env   # once: VITE_API_URL=/api and API_PROXY_TARGET (the local Worker)
pnpm --filter web dev             # vite on http://localhost:5173 (strict port); proxies /api/* to API_PROXY_TARGET (start the api too)
pnpm --filter web build           # typecheck (app, node configs, service worker) + vite build with the PWA service worker
pnpm --filter web preview         # serve dist/ on http://localhost:4173 (same /api proxy): the only way to test the service worker and install the PWA locally
pnpm --filter web test            # vitest: app (jsdom + Testing Library) and gateway Worker (node) projects
pnpm --filter web run deploy      # build + deploy the public Worker (habits): PWA assets + /api gateway
pnpm --filter web cf-typegen      # regenerate worker/worker-configuration.d.ts after editing apps/web/wrangler.jsonc
pnpm --filter mobile start        # expo start (use a development build, not Expo Go, for push)
pnpm --filter @habits/design-tokens generate   # rewrite src/generated/theme.css after editing tokens.ts
pnpm --filter @habits/core test   # vitest for one package (also @habits/contracts, @habits/design-tokens, @habits/api-client)
pnpm typecheck                    # turbo: tsc --noEmit in every package (api build:types runs first for its dependents)
pnpm lint                         # turbo: eslint (root flat config; web/mobile extend it)
pnpm test                         # turbo: vitest in contracts, core, design-tokens, api (@cloudflare/vitest-plugin), api-client, web (jsdom)
pnpm format                       # prettier --write . (format:check to verify)
```

Notes:

- Internal `packages/*` export TypeScript source directly (no build step); relative imports use explicit `.ts` extensions. The one exception is the API's RPC type: `api/app` resolves to declarations emitted into `apps/api/dist/types` (gitignored), so clients never compile the Worker source and its Workers/Node globals (they clash with the DOM types). Run `pnpm typecheck` from the root (turbo builds them first), or `pnpm --filter api build:types` before typechecking a client alone.
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
- Auth tables (`user`, `session`, `account`, `verification`, `rate_limit`) are owned by Better Auth and generated by its CLI into `apps/api/src/db/auth-schema.ts`. User ids are UUIDs (`crypto.randomUUID()`).

The database row of every table, minus `user_id`, is exactly the contract record (`Habit`, `Completion`, `UserSettings`; `PushSubscription` is stored flat): `apps/api/test/rows.test.ts` asserts this at type level. Writes go through `apps/api/src/db/records.ts`, which parses with the contract first (the DB CHECK on `schedule` only requires JSON with a string `type`, so new schedule types need no migration).

Every `user_id` references `user.id` with `ON DELETE CASCADE` (added in `0002_user_fk.sql` by a table rebuild with `PRAGMA defer_foreign_keys = on`, since D1 always enforces FKs and ignores `PRAGMA foreign_keys`). Deleting a user deletes all their data. The dev seed creates the auth user with the fixed `DEV_USER_ID` and a password credential in the same batch as the data.

Differences from the legacy model (intentional):

- No `Day` / `DayHabit` tables; a single `completions` table replaces them.
- Calendar dates are **local calendar dates as `YYYY-MM-DD` text**, never epoch milliseconds (instants like `created_at` are UTC ms; see "Decisions"). This removes the legacy `strftime` weekday workaround and timezone bugs. The weekday is derived in `packages/core`, not in SQL.
- "Possible on date D" = habit not archived-before-D, `start_date <= D`, and the schedule matches D. This logic lives only in `packages/core` (`isHabitPossibleOn(habit, date, { timeZone })`; the time zone turns the `archived_at` instant into a local date, and a habit archived during D still counts on D) and is reused by API and both clients. `core` never reads the clock: callers get today with `todayIn(timeZone, nowMs)`.

### API (`apps/api`)

- Routes are defined with `@hono/zod-openapi` using schemas from `packages/contracts`; OpenAPI docs are served at `/v1/docs` (and JSON at `/v1/docs/json`) only when `ENVIRONMENT=development`. Do not duplicate Zod schemas inside handlers. Errors use `ApiError` from contracts (validation failures are 422 `validation_error`); only `/v1/auth/*` (Better Auth) answers in Better Auth's own format.
- Routes: `GET/POST /v1/habits`, `PATCH /v1/habits/{habit_id}` (rename, reschedule, archive/unarchive), `PUT /v1/habits/{habit_id}/completions/{date}` (`{ completed, id? }`, idempotent, undo writes a tombstone), `GET /v1/day?date=`, `GET /v1/summary?year=`, `GET/PATCH /v1/settings`, `POST /v1/push/subscriptions`, `DELETE /v1/push/subscriptions/{subscription_id}`. Push responses never include the endpoint, keys or token.
- The current instant is injected (`createApp({ now })`; `src/index.ts` is the only place that reads `Date.now()`), and a user's day is always `todayIn(user_settings.timezone, now())`.
- All routes are under `/v1`. Keep changes backward compatible (expand/contract): old mobile builds and queued offline mutations may hit a newer API.
- Date writes: the client sends the local date explicitly. The server accepts dates in `[today - BACKFILL_DAYS, today + 1]` relative to the user's timezone. `BACKFILL_DAYS` is a constant in `packages/core` (default 7, to allow offline sync). Legacy behavior was "today only"; do not widen the editing UI without being asked.
- D1 has no interactive transactions; use `db.batch([...])` for multi-statement atomicity.
- Summary/heatmap data loads the year's live completions and the habits (one query each) and counts each day with `core` (`summarizeDay`), so "possible" and completed counts follow the same rules as the clients.
- Cron Triggers (hourly) evaluate reminders per user timezone and send pushes.

### Auth

Better Auth with the Drizzle adapter on D1, mounted at `/v1/auth/*` and built per request (`apps/api/src/auth/auth.ts`). Email + password (passkey can be added later), minimum 16 characters. Signup is open only while no user exists (optionally only for `OWNER_EMAIL`); `ALLOW_SIGNUP=true` reopens it in development. Web uses cookie sessions (`HttpOnly`, `SameSite=Lax`, `Secure` with the `__Secure-` prefix outside development); mobile uses the Expo plugin (`expo()`) and/or bearer tokens (`bearer()`, token from the `set-auth-token` header) stored with `expo-secure-store`. Sign-in and sign-up are rate limited in the database (`rate_limit` table, keyed by `cf-connecting-ip`). CORS and trusted origins come from `TRUSTED_ORIGINS` (empty in production) plus the `habits://` app scheme.

Every query must filter by the authenticated `user_id`: `requireUser` guards every non-public route, and handlers only use `src/repos/*`, whose functions all take `userId` and scope every statement by it (the one cross-user statement moves a push device, proven by its endpoint/token, to the user who registers it). Never rely only on the client.

How the owner account comes to exist: in production, the owner signs up once (`POST /v1/auth/sign-up/email`) right after the first deploy, with `OWNER_EMAIL` set so nobody else can take the slot; afterwards signup answers 403 `SIGNUP_DISABLED`. In development, `db:seed:local` creates it.

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
- **Password hashing**: Password hashing is deliberately lightweight to fit the free plan's CPU limit; revisit if moving to Workers Paid (raise scrypt to the Better Auth default via the versioned rehash). Details: own scrypt hasher (`apps/api/src/auth/password.ts`, `node:crypto`) with N=2048, r=8, p=1 (~4 ms per hash in local workerd, against ~70 ms for Better Auth's default N=16384, r=16), versioned format `$scrypt$v=1$n=…,r=…,p=…$salt$key`, constant-time comparison, re-hash on a successful sign-in when the stored parameters are weaker than `CURRENT_PARAMS`. Compensated by a 16-character minimum password (`PASSWORD_MIN_LENGTH` in contracts), closed signup and rate limiting.
- **Auth layout** (Phase 3): Better Auth 1.7 under `/v1/auth`, plugins `bearer()` and `expo()`. The auth tables keep Better Auth's `timestamp_ms` columns (read as `Date`), an intentional exception to the "instants are numbers" rule because Better Auth owns those rows. Config: wrangler vars `ENVIRONMENT` (anything but `development` behaves as production), `ALLOW_SIGNUP`, `TRUSTED_ORIGINS`; secrets `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OWNER_EMAIL` (`.dev.vars` / `wrangler secret put`, documented in `apps/api/.dev.vars.example`).
- **Habit start date**: `POST /v1/habits` accepts `start_date >= today - BACKFILL_DAYS` (no upper bound), so a new habit cannot rewrite old heatmap days. Editing a schedule still changes past "possible" counts (no schedule versioning yet).
- **Web client** (Phase 4): code-based TanStack Router routes (no `routeTree.gen.ts` codegen, so `tsc` never depends on a generated file); everything but `/login` sits under a pathless `app` route whose `beforeLoad` redirects to `/login?redirect=`, and any 401 from the API does the same. Sign-in only: the API exposes no "owner exists" check, so there is no signup screen. Session via `better-auth/client` with the cookie on the web origin. The web calls the API at `VITE_API_URL` (`/api`, same origin): the Vite dev and preview servers proxy `/api/*` to `API_PROXY_TARGET`, stripping `/api`; in production the public Worker strips it the same way (see "Production topology"). "Today" is `todayIn(settings.timezone, now())`, re-evaluated on focus, `visibilitychange` and every minute; a different device time zone shows a banner (update or keep, never silent). shadcn/ui components are copied and restyled with token classes only (no shadcn color variables). `danger` (red-400, red-950 surface) was added to the tokens for error UI. PWA: vite-plugin-pwa `injectManifest` with `src/sw/sw.ts` (Phase 6 adds a `push.ts` module to it); precaches only the app shell (Latin font subsets), no runtime caching, `/api/*` excluded from the navigation fallback. Update strategy `prompt`: a new worker waits until the user taps "Atualizar" (SKIP_WAITING + reload); the page checks for updates hourly and on `visibilitychange`. In production `index.html` and `sw.js` are always revalidated (Workers Static Assets default). Versions: Vite 8.3, @vitejs/plugin-react 6.1, TanStack Router 1.170, TanStack Query 5.104, vite-plugin-pwa 2.0 / Workbox 7.4, shadcn CLI 4.21 (not a dependency) with radix-ui 1.7, sonner 2.0, dayjs 1.11, jsdom 30, Testing Library 16.
- **Production topology** (minimal deploy, before Phase 5): two Workers on `*.workers.dev`, no custom domain yet. `habits` (`apps/web/wrangler.jsonc`) serves `apps/web/dist` as Workers Static Assets (SPA fallback) and runs code only for `/api` and `/api/*` (`run_worker_first`): `worker/gateway.ts` strips `/api` and forwards the request unchanged (cookies, `cf-connecting-ip`, origin) through the `API` service binding. `habits-api` (`apps/api`) has `workers_dev: false` and `preview_urls: false`: no public URL, only the binding reaches it. Kept as two Workers so the API dev server and tests never depend on `apps/web/dist`. Public origin for web and mobile: `https://habits.<subdomain>.workers.dev`, API base `<origin>/api`; `BETTER_AUTH_URL` is that origin and `TRUSTED_ORIGINS` stays empty. Production builds read `apps/web/.env.production` (committed, `VITE_API_URL=/api`). Assets keep Cloudflare's default `max-age=0, must-revalidate` (index.html, sw.js, manifest); `public/_headers` makes `/assets/*` immutable. Deploy order: D1 migrations, then the API, then the web.
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
