# api

API do Habits: Hono em Cloudflare Workers, banco D1 (SQLite) via Drizzle, autenticação com Better Auth e o cron de lembretes e expurgo. Publicada como o Worker privado `habits-api`, alcançado só pelo gateway da web.

## Scripts

| Script                                                        | O que faz                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `dev`                                                         | `wrangler dev` em http://localhost:8787                                |
| `test`, `typecheck`, `lint`                                   | Vitest no workerd, tsc, ESLint                                         |
| `db:generate`, `db:migrate:local`, `db:seed:local`            | Migration a partir do schema, aplicar local, dados de dev              |
| `migrations:check`                                            | Bloqueia migrations destrutivas sem aprovação                          |
| `db:backup:local`, `db:restore:prepare`                       | Export local e preparo de restauração                                  |
| `build:types`                                                 | Declarações `AppType` para o `@habits/api-client`                      |
| `vapid:generate`, `cpu-report`, `auth:generate`, `cf-typegen` | Utilitários (ver [DEVELOPMENT](../../docs/DEVELOPMENT.md#api-appsapi)) |
| `deploy`, `db:migrate:remote`, `db:backup:remote`             | Produção, só com o dono ([DEPLOYMENT](../../docs/DEPLOYMENT.md))       |

## Estrutura

- `src/routes/`, `src/repos/`, `src/http/`, `src/auth/`, `src/push/`, `src/cron/`, `src/db/` (schema, registros, seed).
- `migrations/`: SQL gerado pelo drizzle-kit (aditivo, revisado à mão quando preciso).
- `scripts/`: seed, backup e restauração, guarda de migrations, VAPID, relatório de CPU.
- `test/`: testes de integração no workerd.

Arquitetura em [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#api); guia para o agente em [CLAUDE.md](CLAUDE.md).
