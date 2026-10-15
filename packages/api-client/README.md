# @habits/api-client

Cliente tipado da API (Hono RPC `hc`) sobre as declarações `AppType` emitidas por `apps/api`, para os clientes nunca compilarem o código do Worker. Envia o cabeçalho `X-Habits-Schedule-Version`. Usado pela web e pelo mobile.

## Scripts

`test`, `typecheck`, `lint`. Rode da raiz com `pnpm --filter @habits/api-client <script>`.

## Estrutura

`src/index.ts` e os testes. Os tipos dependem de `pnpm --filter api build:types` (o `pnpm typecheck` da raiz roda antes).

Pacote interno e privado: exporta TypeScript direto, sem build. Arquitetura em [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
