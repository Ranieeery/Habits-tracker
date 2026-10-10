# apps/web

Vite + React 19 PWA (secondary client). See the root `CLAUDE.md` for architecture, date rules and the Phase 4 decisions.

## Setup

- `cp .env.example .env`: `VITE_API_URL=/api` (the browser's API base, same origin) and `API_PROXY_TARGET` (dev/preview only: where Vite proxies `/api/*`, with the prefix stripped). Never hardcode an API URL.
- Run the API (`pnpm --filter api dev`) and `pnpm --filter web dev`. The service worker is off in dev: use `pnpm --filter web build && pnpm --filter web preview` to test the PWA.
- Production builds read `.env.production` (committed, no secrets: `VITE_API_URL=/api`); the build itself needs no `API_PROXY_TARGET`.

## Layout

- `src/main.tsx`: builds the real services (API client, auth, clock, device time zone) and the router; renders `<App>` plus `UpdatePrompt`. `src/App.tsx`: providers shared with the tests.
- `src/router.tsx`: code-based route tree. `/login` is public; the pathless `app` route guards the rest (`beforeLoad` checks the session, `loader` caches the settings that "today" needs). `createAppRouter(services, { history })` also creates the QueryClient, whose 401 handler sends the user to `/login?redirect=`.
- `src/lib/`:
  - `services.ts`: `Services` (`api`, `auth`, `now`, `deviceTimeZone`) through `ServicesContext`. `systemClock` is the only place that reads `Date.now()`.
  - `auth.ts`: `AuthService` over `better-auth/client` (`/v1/auth` under the API base), errors mapped to `AuthError` reasons.
  - `queries.ts`: query keys, `queryOptions` and mutation calls for every resource. Components never call the API client directly.
  - `use-today.ts`: `useToday()` = `todayIn(settings.timezone, now())`, refreshed on focus, `visibilitychange` and every minute. Always the saved time zone, never the device's.
  - `format.ts`: dayjs `pt-br` formatting only (date math stays in `@habits/core`). `errors.ts`: pt-BR messages for API errors. `redirect.ts`: same-app paths only after login.
- `src/features/<screen>/`: `auth` (login), `heatmap` (grid from `buildYearGrid` + `monthLabels`), `day` (day view, optimistic toggle in `use-toggle-completion.ts`), `habits` (list, dialog, `HabitForm` with the weekday picker), `settings` (time zone, sign-out, `TimezoneBanner`).
- `src/components/`: app layout and nav, loading/empty/error states, route states, `update-prompt.tsx`. `src/components/ui/`: shadcn/ui components (added with `pnpm dlx shadcn@latest add <name>` using `components.json`, then restyled with token classes and `@/lib/utils.ts` imports; the CLI may add stray dependencies such as `cn` or `next-themes`: remove them).
- `src/sw/`: the service worker (vite-plugin-pwa `injectManifest`). `sw.ts` only imports modules: `lifecycle.ts` (SKIP_WAITING, `clientsClaim`), `app-shell.ts` (precache + navigation fallback, `/api` excluded). Phase 6 adds `push.ts`. No runtime caching: API responses are authenticated and never cached.

## Rules

- Only token classes (`bg-surface`, `text-muted`, `bg-heatmap-3`, `text-danger`…), never raw colors. Heatmap level classes are literal strings in `features/heatmap/heatmap-utils.ts`.
- Interactive elements keep the 44px minimum (`min-h-touch`, `size-touch`); the global `:focus-visible` outline lives in `styles.css`.
- Only today is editable in the day view (legacy behavior); past days are read-only, future heatmap days are placeholders.
- UI text in pt-BR. Imports inside `src` use the `@/` alias with explicit extensions.

## Tooling

- TypeScript projects: `tsconfig.json` (app, DOM, excludes `src/sw`), `tsconfig.sw.json` (WebWorker), `tsconfig.node.json` (`vite.config.ts`, `vitest.config.ts`), `tsconfig.worker.json` (`worker/`, Workers types). `typecheck` runs all four; `build` runs `typecheck` then `vite build`.
- `vite.config.ts` reads the theme color from `@habits/design-tokens` for the manifest and the `theme-color` meta, and exports `baseConfig` reused by `vitest.config.ts`.
- Tests: two Vitest projects in `vitest.config.ts`: `app` (Testing Library in jsdom) and `worker` (node, `worker/**/*.test.ts`). For app tests, `src/test/setup.ts` stubs `scrollTo`, `ResizeObserver` and `matchMedia` and clears sonner toasts. `src/test/harness.tsx`: `renderApp(path, options)` renders the real router with a fake API (`"METHOD /v1/path"` handlers), fake auth, a fixed clock (`NOW` = 2026-10-09 in São Paulo) and a device time zone; `renderInRouter(ui)` renders one component inside a minimal router.
- ESLint extends the root config plus `react-hooks` and `react-refresh` (`eslint.config.js`): keep non-component exports out of `.tsx` component files.

## Deploy (public Worker `habits`)

- `wrangler.jsonc`: Workers Static Assets from `./dist` with the SPA fallback; `run_worker_first: ["/api", "/api/*"]`, so only API calls run `worker/index.ts`. `worker/gateway.ts` (`toApiRequest`) strips `/api` and forwards the request as is through the `API` service binding to `habits-api`. After editing `wrangler.jsonc`, run `pnpm --filter web cf-typegen` (`worker/worker-configuration.d.ts`, generated, not linted or formatted).
- `public/_headers` makes `/assets/*` immutable; everything else keeps the default `max-age=0, must-revalidate`, so `index.html` and `sw.js` are revalidated on every load.
- `pnpm --filter web run deploy` = build + `wrangler deploy`. Deploy the API first when both change (the binding target must exist, and the new web may call new API routes).
