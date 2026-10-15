# @habits/contracts

Schemas Zod e tipos inferidos de toda requisição, resposta e do protocolo de sync (versão 1). Fonte única dos formatos entre API, web e mobile: os tipos são inferidos, nunca escritos à mão.

## Scripts

`test`, `typecheck`, `lint`. Rode da raiz com `pnpm --filter @habits/contracts <script>`.

## Estrutura

`src/`: um arquivo por recurso (`habit.ts`, `schedule.ts`, `completion.ts`, `reschedule.ts`, `day.ts`, `summary.ts`, `settings.ts`, `push.ts`, `sync.ts`, `errors.ts`), exportados por `index.ts`.

Pacote interno e privado: exporta TypeScript direto, sem build. Arquitetura em [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
