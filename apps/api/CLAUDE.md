# apps/api

Hono on Cloudflare Workers. See the root `CLAUDE.md` for architecture, auth, dates and sync rules.

- Entry: `src/index.ts`; every route lives under the `/v1` base path. `GET /v1/health` returns the `package.json` version.
- Worker config: `wrangler.jsonc`. After editing it, run `pnpm --filter api cf-typegen` to regenerate `src/worker-configuration.d.ts` (generated: do not edit, excluded from lint and Prettier). The `Env` type comes from that file.
- Runtime is workerd with `nodejs_compat`, not Node: check any new dependency runs on Workers.
- Tests: `test/*.test.ts` run inside workerd through `@cloudflare/vitest-plugin` (`vitest.config.ts`), with their own `test/tsconfig.json`. `test/apply-migrations.ts` applies `migrations/` to the test D1 before each file; D1 data is shared between tests of a file, so clean up in `beforeEach`. `typecheck` checks `src`, `test` and the Node-side files (`tsconfig.node.json`: `scripts/`, `drizzle.config.ts`, `vitest.config.ts`).
- Secrets: Wrangler secrets in production, `.dev.vars` locally (gitignored). Never put secrets in `wrangler.jsonc`.

## Database

- D1 binding `DB`. `database_id` in `wrangler.jsonc` is a placeholder until the remote database is created (Phase 8); local D1 ignores it.
- Schema: `src/db/schema.ts` (Drizzle). `createDb(env.DB)` in `src/db/client.ts`.
- Migrations: edit the schema, run `pnpm --filter api db:generate`, review the SQL in `migrations/` and commit it with `migrations/meta/`. Never edit an applied migration; add a new one.
- `src/db/records.ts` converts between rows and contract records, parsing with `@habits/contracts` on every write and read. Do not insert rows that bypassed it.
- Instants are `number` ms (`integer({ mode: "number" })`); calendar dates are `YYYY-MM-DD` text with a CHECK (`date(x) IS x`). In SQLite CHECKs, compare with `IS` when an operand may be NULL: a NULL result passes the CHECK.
- Batches: D1 allows at most 100 bound parameters per statement; chunk multi-row inserts (see `src/db/seed/apply.ts`).

## Dev seed

`src/db/seed/`: `build.ts` (pure, deterministic for a reference `today`, fixed `DEV_USER_ID`), `validate.ts` (contracts + "possible on date" checks), `apply.ts` (one batch: delete the dev user's rows, insert the seed). `scripts/seed-local.ts` runs it against the local `.wrangler/state` through Wrangler's `getPlatformProxy()`. Re-seeding replaces all data of the dev user.
