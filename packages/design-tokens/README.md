# @habits/design-tokens

Tokens visuais (conjunto `night`: cores, fontes, espaçamentos, raios) que geram o tema do Tailwind v4 (web) e o preset do Tailwind v3 (NativeWind, mobile), idênticos. Também gera o ícone, a splash e os ícones da web a partir da marca. Os testes garantem a paridade e o contraste AA.

## Scripts

`generate` (reescreve o tema depois de mexer em `tokens.ts`), `brand` (regera os PNGs versionados; os nativos pedem build novo), `test`, `typecheck`, `lint`. Rode da raiz com `pnpm --filter @habits/design-tokens <script>`.

## Estrutura

`src/tokens.ts` (valores), `src/brand.ts` (marca), `src/generated/` (tema gerado), `scripts/` (geradores).

Pacote interno e privado: exporta TypeScript direto, sem build. Arquitetura em [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
