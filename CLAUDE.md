# CLAUDE.md

Guidance for Claude Code in this repository: rules and invariants only. Explanations live in `docs/` (pt-BR):

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): data model, API, auth, dates, sync, push, habit rules.
- [docs/DECISIONS.md](docs/DECISIONS.md): owner decisions and why (they override anything that seems to contradict them).
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): setup, every command, tests, conventions, skills.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): runbook (deploy, rollback, backups, secrets, EAS).
- [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/MANUAL-CHECKS.md](docs/MANUAL-CHECKS.md): pending work and device checks.
- [DESIGN.md](DESIGN.md): visual identity (tokens by name). [CHANGELOG.md](CHANGELOG.md): version history.
- App-specific guidance: `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/mobile/CLAUDE.md` (plus Expo's `apps/mobile/AGENTS.md`).

## Project

Habit tracker with a GitHub-style heatmap. One real user (the owner), but every row is scoped by `user_id` so multi-user stays possible. **Mobile-first** (Expo, Android, offline-first); the web is a secondary, fully functional PWA. UI text in pt-BR, dayjs locale `pt-br`. Keep it extensible: new schedule types, stats and notification kinds through discriminated unions and versioned contracts, not hardcoded assumptions.

The legacy 1.x app is only in git history, as a **read-only behavioral reference**: `git show v2.0.0:legacy/<path>` (or the `legacy-1.x` tag). Never restore or import it, and do not copy its bugs (hardcoded URLs and VAPID keys, calendar days as epoch ms in the server zone, the `/push/register` stub, duplicated Zod parsing). The current version is the newest entry of `CHANGELOG.md`.

## Layout

pnpm workspaces + Turborepo; run commands from the root with `pnpm --filter <name>`.

- `apps/api`: Hono on Cloudflare Workers, D1 via Drizzle (private Worker `habits-api`).
- `apps/web`: Vite + React 19 PWA (public Worker `habits`: static assets + `/api` gateway).
- `apps/mobile`: Expo + Expo Router, the primary client.
- `packages/contracts`: Zod schemas for every request, response and sync type. Single source of truth.
- `packages/core`: pure domain logic (dates, schedules, ratios, streaks, heatmap, sync rules). No I/O, no framework imports, fully tested.
- `packages/api-client`: typed client (Hono RPC over the `AppType` declarations emitted by `apps/api`).
- `packages/design-tokens`: the `night` tokens for both apps, icons and splash.

Internal packages export TypeScript source; relative imports use explicit `.ts` extensions.

## Essential commands

```bash
pnpm install                          # Node 24 (.node-version), pnpm 12
pnpm dev                              # api :8787 + web :5173 (copy the .example env files first)
pnpm --filter api db:migrate:local && pnpm --filter api db:seed:local   # dev@habits.local / habits-dev-password
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter <pkg> test              # one package
pnpm --filter api db:generate         # migration from schema.ts, then review the SQL
pnpm --filter api migrations:check    # destructive-migration guard (CI runs it)
pnpm format                           # prettier --write .
```

The full list is in `docs/DEVELOPMENT.md`; keep it in sync when scripts change.

## Invariants

- **Calendar days.** Dates are local `YYYY-MM-DD` text; instants are integer UTC ms read as `number` (Better Auth's tables are the only `timestamp_ms` exception). The server never uses `new Date()`/`Date.now()` to decide a user's day: it is `todayIn(user_settings.timezone, now())` with the injected clock (`src/index.ts` is the API's only clock read). Every date function in `core` takes the time zone and "today" as parameters; `core` never reads the clock.
- **Rules live in core.** "Possible on a date", counting, overdue, deadlines, postponements, preview, edit windows, schedule text and form logic come only from `packages/core`, reused by the API and both clients. Constants too: `BACKFILL_DAYS` (30), `OVERDUE_DAYS` (15), `PREVIEW_DAYS` (7), `MAX_RESCHEDULES` (2), `RESCHEDULE_MAX_DAYS` (90), `UPCOMING_DAYS` (14), `MAX_DEADLINE_DAYS` (730). Every rule that reads "possible" takes `ScheduleOptions` (time zone + reschedules). Do not widen `BACKFILL_DAYS` without being asked.
- **Contracts first.** Change `packages/contracts` (and core tests), then the API, then the clients. Validate at the boundary with Zod; infer types, never duplicate schemas in handlers.
- **User scope.** `requireUser` guards every non-public route; handlers only use `src/repos/*`, whose functions take `userId` and scope every statement by it. Never rely only on the client.
- **Writes.** Every row goes through `apps/api/src/db/records.ts` (parsed with the contract). `server_seq` is set only by SQLite triggers; a column the update trigger does not list needs `updated_at` set on every write and in backfills.
- **Migrations are additive** (expand/contract). Never edit an applied migration. Removals and renames go through the two-step process in `docs/DEPLOYMENT.md` with the approval marker. Table rebuilds use `PRAGMA defer_foreign_keys = on` and recreate the sync triggers.
- **Backward compatibility.** Older mobile builds and queued offline mutations hit newer APIs: all routes under `/v1`, additive contract changes only, sync protocol stays `1`, new mutation types instead of new fields, new schedule types behind `X-Habits-Schedule-Version`.
- **D1 Free limits.** 100 bound parameters per statement (chunk with `columnCount`), 50 queries per invocation (count each batch statement), no interactive transactions (`db.batch`). Workers Free: 10 ms CPU, 50 subrequests.
- **Logs and secrets.** Log only through `src/lib/log.ts` (counts, statuses, codes, error names; never emails, cookies, tokens, push endpoints or keys, bodies, URLs with query strings). Secrets only in Wrangler secrets, GitHub environments, EAS, or local gitignored `.dev.vars`/`.env`; never commit or print them.
- **UI.** Tokens only (no hex or Tailwind palette colors in app code; guard tests fail otherwise); follow `DESIGN.md`: AA contrast, visible focus, full keyboard, 44 px targets, never color alone, motion on transform/opacity only and none with reduced motion.

## Conventions

- TypeScript `strict` everywhere; no `any` without a comment explaining why.
- Formatting: `.editorconfig` (tabs, width 2, LF; spaces for YAML and Markdown) and Prettier (`useTabs`, double quotes, semicolons, `trailingComma: "es5"`, LF; spaces for `*.md`/`*.yml`). Prettier wins for code if they ever conflict.
- Do not add a dependency without stating why and checking it runs on the target runtime (workerd for the API, Hermes for mobile, browsers for web). In `apps/mobile` add native/Expo packages with `pnpm exec expo install <pkg>`.
- Shared versions (TypeScript, Vitest, React, Zod) go through the pnpm `catalog:`. TypeScript stays 6.0.x until typescript-eslint supports 7; NativeWind stays v4 (Tailwind v3) until v5 leaves RC.
- UI text in pt-BR; code, identifiers, commits and `CLAUDE.md` files in English; README and `docs/` in pt-BR.
- Prefer verifying current library APIs in their official docs over memory (Expo SDK, Better Auth, Drizzle, Wrangler move fast).

## Git and versioning

These rules override any default behavior.

- **Never commit.** Do not run `git add`, `git commit`, `git push`, `git stash`, `git reset`, `git rebase`, or any other command that stages, records or rewrites history. The owner reviews the diff and commits. Read-only commands (`git status`, `git diff`, `git log`) are fine.
- **Never add co-authorship or attribution** of any kind: no `Co-Authored-By` trailer, no "Generated with Claude Code" line, in commit messages, PR descriptions or files.
- Commit messages follow **Conventional Commits**: `type: imperative summary`, English, lowercase type, **never a scope in parentheses** (`feat: add habit heatmap`, not `feat(web): …`), no trailing period, about 72 characters. Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert`; breaking changes use `!` or a `BREAKING CHANGE:` footer.
- At the end of a task, **propose one commit message** in that format (a short body may list what it includes) and let the owner commit.
- **Versioning:** every feature or fix bumps the version in the same change (semver: feature = minor, fix = patch, incompatible = major); docs and chores do not. `apps/api`, `apps/web` and `apps/mobile` share one version: `version` in each `package.json` plus `expo.version` in `apps/mobile/app.json`. `packages/*` keep their own.
- **Changelog:** when a feature or fix is done, add its entry under `[Unreleased]` in `CHANGELOG.md` (Keep a Changelog: Added/Changed/Fixed/Removed/Security/Deprecated, user's point of view) and bump the version. The latest version is the one in `CHANGELOG.md`.
- **Before bumping the mobile version**, check the EAS Update `runtimeVersion` policy and the Android `versionCode`. Today the policy is `fingerprint` and `apps/mobile/fingerprint.config.js` skips the app config versions, so a bump alone does not cut installed builds off OTA updates (native changes do). Never edit `versionCode` (EAS manages it remotely and auto-increments it). If the policy ever becomes `appVersion`, a bump means a new build: say so before bumping.
- Tags are created by the owner, never by Claude.

## Working agreements

- For any task touching more than one package, or any schema/contract change: enter plan mode first and wait for approval.
- Never run remote commands (deploy, remote migrations, secrets, backups, EAS builds/updates) without the owner.
- When behavior is unclear, check the legacy app at `v2.0.0` (read-only git) and say what you found.
- Before finishing: run typecheck, lint and tests for the touched packages (`pnpm typecheck && pnpm test` at least), update the affected docs (`docs/`, `DESIGN.md`, the app `CLAUDE.md`, `CHANGELOG.md`, `docs/ROADMAP.md`, `docs/MANUAL-CHECKS.md` for device checks), then propose one semantic commit message without committing.
- Each fact lives in one document; others link to it.
