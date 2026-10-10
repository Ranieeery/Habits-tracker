# apps/api

Hono on Cloudflare Workers. See the root `CLAUDE.md` for architecture, auth, dates and sync rules.

- Entry: `src/index.ts`; every route lives under the `/v1` base path. `GET /v1/health` returns the `package.json` version.
- Worker config: `wrangler.jsonc`. After editing it, run `pnpm --filter api cf-typegen` to regenerate `src/worker-configuration.d.ts` (generated: do not edit, excluded from lint and Prettier). The `Env` type comes from that file.
- Runtime is workerd with `nodejs_compat`, not Node: check any new dependency runs on Workers.
- Tests: `test/*.test.ts` run inside workerd through `@cloudflare/vitest-plugin` (`vitest.config.ts`), with their own `test/tsconfig.json`. `typecheck` checks both `src` and `test`.
- Secrets: Wrangler secrets in production, `.dev.vars` locally (gitignored). Never put secrets in `wrangler.jsonc`.
- The D1 binding (`DB`), Drizzle schema and migrations arrive in Phase 2.
