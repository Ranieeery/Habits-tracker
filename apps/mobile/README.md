# mobile

App Android do Habits (Expo + Expo Router, NativeWind, Reanimated), o cliente principal. Offline-first: os dados ficam num SQLite no aparelho e sincronizam com a API, inclusive em segundo plano. Precisa de um development build (não roda no Expo Go).

## Scripts

| Script                      | O que faz                                                              |
| --------------------------- | ---------------------------------------------------------------------- |
| `start`                     | `expo start` para o development build                                  |
| `test`, `typecheck`, `lint` | Vitest (lógica pura, banco local e sync em `node:sqlite`), tsc, ESLint |

Builds e updates OTA saem pelos workflows do GitHub Actions ([DEPLOYMENT](../../docs/DEPLOYMENT.md#mobile-builds-e-updates-eas)).

## Estrutura

- `src/app/`: rotas (Expo Router).
- `src/features/<tela>/`: hoje, histórico (heatmap), hábitos, dia, ajustes, sincronização.
- `src/data/`: repositórios, banco local (`local/`) e motor de sync (`sync/`).
- `src/ui/`, `src/lib/`: componentes e utilitários.

Como rodar no aparelho: [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md#app-mobile-development-build). Guia para o agente em [CLAUDE.md](CLAUDE.md).
