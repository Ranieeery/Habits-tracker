# apps/web

Vite + React 19 PWA (secondary client). See the root `CLAUDE.md` for architecture and design rules.

- Entry: `src/main.tsx` → `src/App.tsx`. Styles: `src/styles.css` (Tailwind v4 via `@tailwindcss/vite`), which imports the theme from `@habits/design-tokens/theme.css`. Use only token classes, never raw colors.
- API base URL comes from `VITE_API_URL` (see `.env.example`; typed in `src/env.d.ts`). Never hardcode it.
- ESLint extends the root config plus `react-hooks` and `react-refresh` (`eslint.config.js`).
- `build` runs `tsc --noEmit` before `vite build`; output in `dist/` (gitignored).
- Still to come (Phase 4): TanStack Router and Query, shadcn/ui, `vite-plugin-pwa` with the push service worker.
