# apps/api

Hono on Cloudflare Workers. See the root `CLAUDE.md` for architecture, auth, dates and sync rules.

- Entry: `src/index.ts` exports `createApp({ now: () => Date.now() })`, the only place that reads the clock. `src/app.ts` assembles the app under `/v1`: context and CORS middleware, `GET /v1/health`, Better Auth at `/v1/auth/*`, docs at `/v1/docs` (development only), then `requireUser` and the route groups. Order matters: everything registered after `requireUser` (unknown paths included) needs a session.
- Layout:
  - `src/auth/`: `options.ts` (schema-shaping Better Auth options, shared with the CLI), `auth.ts` (`createAuth`: closed signup, rate limits, trusted origins, cookies, re-hash on sign-in), `password.ts` (lightweight versioned scrypt hasher).
  - `src/http/`: `context.ts` (`AppEnv`, `router()`, `authOf`), `errors.ts` (`ApiError` bodies, status per code, OpenAPI response helpers, the 422 validation hook), `require-user.ts`, `today.ts` (the user's day from their time zone and the injected clock).
  - `src/routes/`: one `router()` per group with `createRoute` + `.openapi()` chains (keep them chained: the RPC types come from the chain).
  - `src/repos/`: every database access of the routes. Each function takes `userId` and scopes every statement by it; handlers never query `db` directly.
  - `src/config.ts` (typed bindings), `src/lib/` (`Clock`, `uuidV7`), `src/env.d.ts` (secret bindings that `wrangler types` cannot see).
- RPC type for clients: `src/app-type.ts` is exported as `api/app`, resolved to the declarations that `pnpm --filter api build:types` emits into `dist/types` (gitignored; turbo runs it before `typecheck`). Never import runtime code from it.
- Worker config: `wrangler.jsonc` (`vars`: `ENVIRONMENT`, `ALLOW_SIGNUP`, `TRUSTED_ORIGINS`). After editing it, run `pnpm --filter api cf-typegen` to regenerate `src/worker-configuration.d.ts` (generated with `--strict-vars=false`: do not edit, excluded from lint and Prettier). The `Env` type comes from that file plus `src/env.d.ts`.
- Runtime is workerd with `nodejs_compat`, not Node: check any new dependency runs on Workers. `node:crypto` (scrypt) and `Buffer` are available.
- Tests: `test/*.test.ts` run inside workerd through `@cloudflare/vitest-plugin` (`vitest.config.ts`, which also sets the test bindings and a random `BETTER_AUTH_SECRET`), with their own `test/tsconfig.json`. `test/apply-migrations.ts` applies `migrations/` to the test D1 before each file; D1 data is shared between tests of a file, so call `resetDb()` in `beforeEach` (deleting users cascades to all data). `test/helpers.ts` has `makeApi(nowIso, envOverrides)` (fixed, movable clock), `createUser`, `signUp`/`signIn`, `cookieOf`/`bearerOf`. `typecheck` checks `src`, `test` and the Node-side files (`tsconfig.node.json`: `scripts/`, `drizzle.config.ts`, `vitest.config.ts`).
- Secrets: Wrangler secrets in production, `.dev.vars` locally (gitignored; copy `.dev.vars.example`). Never put secrets in `wrangler.jsonc`.

## Database

- D1 binding `DB`. `database_id` in `wrangler.jsonc` is a placeholder until the remote database is created (Phase 8); local D1 ignores it.
- Schema: `src/db/schema.ts` (Drizzle), which re-exports the Better Auth tables of `src/db/auth-schema.ts`. That file is generated (`pnpm --filter api auth:generate`, from `src/auth/options.ts` through `scripts/auth-cli.ts`): regenerate it instead of editing it, then run `db:generate`. `createDb(env.DB)` in `src/db/client.ts`.
- Every domain `user_id` references `user.id` with `ON DELETE CASCADE`.
- Migrations: edit the schema, run `pnpm --filter api db:generate`, review the SQL in `migrations/` and commit it with `migrations/meta/`. Never edit an applied migration; add a new one. A migration that rebuilds tables must replace drizzle-kit's `PRAGMA foreign_keys=OFF/ON` with `PRAGMA defer_foreign_keys = on` (D1 always enforces foreign keys), as `0002_user_fk.sql` does.
- `src/db/records.ts` converts between rows and contract records, parsing with `@habits/contracts` on every write and read. Do not insert rows that bypassed it.
- Instants are `number` ms (`integer({ mode: "number" })`); calendar dates are `YYYY-MM-DD` text with a CHECK (`date(x) IS x`). In SQLite CHECKs, compare with `IS` when an operand may be NULL: a NULL result passes the CHECK. Exception: Better Auth's tables use `timestamp_ms` (`Date`).
- Batches: D1 allows at most 100 bound parameters per statement; chunk multi-row inserts (see `src/db/seed/apply.ts`).

## Dev seed

`src/db/seed/`: `build.ts` (pure, deterministic for a reference `today`, fixed `DEV_USER_ID`, `DEV_USER_EMAIL`/`DEV_USER_PASSWORD`), `validate.ts` (contracts + "possible on date" checks), `apply.ts` (one batch: delete the dev user, which cascades to all their rows, then insert the auth user, its password credential, settings, habits and completions; the password hash is passed in so `build.ts` stays pure). `scripts/seed-local.ts` runs it against the local `.wrangler/state` through Wrangler's `getPlatformProxy()` and prints the sign-in. Re-seeding replaces the dev user and all their data (sessions included).
