# @habits/core

Lógica de domínio pura: datas e fuso, agendas, possível e contado, atrasados, prazos, adiamentos, prévia, sequências, resumo, grade do heatmap, notificações e regras de sync. Sem I/O e sem framework; usada pela API e pelos dois clientes. Nunca lê o relógio: recebe "hoje" e o fuso como parâmetros.

## Scripts

`test`, `typecheck`, `lint`. Rode da raiz com `pnpm --filter @habits/core <script>`.

## Estrutura

`src/`: um módulo por regra, cada um com o seu `*.test.ts` (por exemplo `schedule.ts`, `overdue.ts`, `deadline.ts`, `reschedule.ts`, `preview.ts`, `grid.ts`, `sync.ts`).

Pacote interno e privado: exporta TypeScript direto, sem build. Arquitetura em [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
