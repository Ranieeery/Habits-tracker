# web

PWA do Habits (Vite + React 19, TanStack Router e Query, Tailwind v4, shadcn/ui), com Web Push no service worker. Publicada como o Worker público `habits`: assets estáticos e um gateway que repassa `/api/*` para a API.

## Scripts

| Script                      | O que faz                                                                    |
| --------------------------- | ---------------------------------------------------------------------------- |
| `dev`                       | Vite em http://localhost:5173, com proxy de `/api` para `API_PROXY_TARGET`   |
| `build`                     | typecheck dos quatro projetos TypeScript + `vite build` com o service worker |
| `preview`                   | Serve `dist/` em http://localhost:4173 (testar PWA e push)                   |
| `test`, `typecheck`, `lint` | Vitest (jsdom e worker), tsc, ESLint                                         |
| `cf-typegen`                | Regenera os tipos do Worker                                                  |
| `deploy`                    | Build + `wrangler deploy` (só com o dono)                                    |

## Estrutura

- `src/features/<tela>/`: heatmap, dia, hoje, hábitos, ajustes, login.
- `src/components/`, `src/lib/`, `src/sw/` (service worker).
- `worker/`: gateway `/api` e testes dos cabeçalhos.
- `public/_headers`: CSP e cache.

Guia para o agente em [CLAUDE.md](CLAUDE.md); visual em [DESIGN.md](../../DESIGN.md).
