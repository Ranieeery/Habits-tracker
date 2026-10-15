---
name: release-ops
description: CI/CD and production operations for Habits (GitHub Actions workflows, Dependabot, Cloudflare tokens, D1 backups in R2 and restores, migration guard, web security headers, EAS builds and OTA updates, alerts, releases and the changelog). Use when touching .github/, deploy or backup steps, wrangler/EAS config, migrations safety, the deploy runbook or a release.
---

# CI/CD, operations and releases

Sources of truth (pt-BR):

- Runbook (first deploy, daily deploy, rollback, backups and restores, secret rotation, two-step destructive changes, observability, CPU measurement, costs, post-deploy checklist, troubleshooting, free-plan limits): `docs/DEPLOYMENT.md`.
- Why each choice was made: `docs/DECISIONS.md`, D4 (topology), D11 (CI/CD and operation) and D12 (mobile builds and OTA).
- Version history: `CHANGELOG.md`. Pending deploys and owner tasks: `docs/ROADMAP.md`.

## Rules

- **Never run remote commands without the owner**: deploy, `db:migrate:remote`, `wrangler secret`, remote backups or restores, `wrangler rollback`, EAS builds or updates, `gh` changes to environments or secrets.
- **Deploy order**: D1 backup, migrations, API, web, then the OTA. The `deploy` workflow follows it; a manual deploy must too.
- **Migrations are additive.** `pnpm --filter api migrations:check` (CI) blocks `DROP`, `ALTER TABLE … RENAME` and `DELETE FROM` unless the file has `-- migration-guard: destructive-ok <reason>`, added only for the approved contract step of a two-step change.
- **Workflows**: actions pinned by SHA with `contents: read`; Wrangler from the lockfile (`pnpm exec wrangler`), `eas-cli` pinned through `pnpm dlx`; no secrets in `checks.yml`; workflows never print SQL, data or secrets (the logs are public). Dependabot covers only GitHub Actions (it supports pnpm up to v10).
- **Backups** stay in the private R2 bucket or the gitignored `backups/`, never as workflow artifacts. Production restores go to a new database, then the binding is switched.
- **Web headers** live in `apps/web/public/_headers` and are guarded by `apps/web/worker/headers.test.ts`; adding an inline script or a third-party origin means updating the CSP.
- **Mobile**: `runtimeVersion` policy `fingerprint`; native changes need a new build, JS goes out as OTA. Builds and updates run on Linux (`mobile-build.yml`, `deploy.yml`): from Windows the fingerprint differs ("Runtime version mismatch").
- **Releases**: every feature or fix bumps the shared version (api, web, mobile `package.json` plus `expo.version`) and adds its entry under `[Unreleased]` in `CHANGELOG.md`; on release the section gets the version and date. Tags are created by the owner.
- Keep `docs/DEPLOYMENT.md`, `docs/DECISIONS.md` and this skill in sync when operations change.
