# Changelog

All notable changes to Habits are documented in this file. API, web and mobile always share one version.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions before 2.0.0 (the legacy app made of three separate projects: Fastify server, React web and Expo mobile) are not detailed here; their code is kept in the git history at the tag `legacy-1.x`.

## [Unreleased]

### Changed

- Documentation restructured: README as the entry point, `docs/` for architecture, decisions, development, deployment, roadmap and manual checks, this changelog as the only version history, MIT license and a security policy. No behavior change.

## [2.16.2] - 2026-10-14

### Fixed

- Closing a habit form (create or edit, web dialogs and mobile sheets and screens) with unsaved changes now asks "Descartar alterações?" first, with "Continuar editando" as the default; without changes, after typing and erasing, or with only spaces, it closes at once. Saving never asks.

## [2.16.1] - 2026-10-14

### Fixed

- The habit actions menu also appears on days opened from the history (web and mobile) and on every row of the preview days; only the web home "Hoje" panel stays without it.

## [2.16.0] - 2026-10-14

### Added

- Postpone one occurrence of a single-date or days-of-month habit ("Adiar"): up to 2 times, up to 90 days ahead and before the next occurrence, without a failure on its original date; the failure and the overdue rule move to the new date, and a completion in between fulfills it early. Works offline on the mobile.
- "Adiado de" and "Adiado para" notes on the affected days, and "Desfazer" for the last postponement.

### Changed

- Database migration `0008` (new `habit_reschedules` table) and mobile local migration 4. Update the phone before postponing anything; older apps keep showing the habit on its original date.

## [2.15.0] - 2026-10-14

### Added

- Habit actions menu on the rows of the Hoje tab, from a "⋮" button, a right click (web) or a 1 s long press (mobile): "Editar hábito" without leaving the day, "Ver descrição completa", and "Arquivar" at once with "Desfazer" (or "Desarquivar").
- "Arquivado" badge on today and past days for archived habits.

## [2.14.1] - 2026-10-14

### Changed

- Redesigned description quick look on web and mobile: the name on two lines at most, a body that fades out when cut, and an always-present "Abrir descrição completa" action. The mobile sheet no longer slides with "remove animations".

## [2.14.0] - 2026-10-14

<!-- verify: the previous version table dated this release 2026-10-13; the release commit is dated 2026-10-14 -->

### Added

- The heatmap previews the next 7 days as dashed, read-only cells; opening one shows what is planned for that day ("Dia futuro, somente leitura"). Statistics ignore future days, and dates past today + 7 are blocked. "Futuro" in the legend.

### Fixed

- The web home screen no longer scrolls sideways at 390 px when a habit has a long description.

## [2.13.0] - 2026-10-13

### Added

- Tasks with a deadline ("Até uma data"): done any day until the due date (only the first completion counts), listed under "Com prazo" on today with "faltam N dias", "Vence amanhã" or "Vence hoje"; a failure on the due date when still open, then overdue for 15 days.
- "Já concluída em DD/MM" on a missed due date done later; settled tasks move to "Passados"; the morning digest says "Vence hoje" and "Vence amanhã".

### Changed

- A due date is locked once it has passed. Schedule version 3: older clients never see deadline tasks, so update the phone before creating the first one.

## [2.12.0] - 2026-10-13

### Added

- Habit descriptions in plain text with **bold**, _italic_, lists and links (nothing rendered as HTML), a note icon on the day's rows with a quick look, and a habit page with the whole text.

### Changed

- Database migration `0007` (additive) and mobile local migration 3.

## [2.11.0] - 2026-10-13

### Added

- Delete archived habits (they leave every day, past ones too) with "Desfazer" for 6 s, on the web and on the mobile (offline).

## [2.10.1] - 2026-10-13

### Fixed

- The mobile "Novo hábito" sheet stays visible with the keyboard open: it shrinks to the space above the keyboard and the form scrolls inside.

## [2.10.0] - 2026-10-13

### Added

- Mobile heatmap: hold a square to see its date and result in a bubble, slide to sweep other days, lift to close. A quick tap still opens the day.

## [2.9.0] - 2026-10-13

### Added

- New app icon (adaptive and themed), notification icon, splash and web icons (favicon, Apple touch, PWA and maskable) drawn from the app's mark.

### Changed

- The mobile app needs a new build for this version (native assets changed); later versions reach it as over-the-air updates.

## [2.8.1] - 2026-10-13

### Fixed

- The web says "Não foi possível ativar o resumo" when turning the morning digest on fails, and a failed save shows one message instead of two.

## [2.8.0] - 2026-10-13

### Added

- Overdue habits: a days-of-month, single-date or yearly habit missed on its day shows first on today's list with "Atrasado desde DD/MM" for up to 15 days, marked with today's date. The missed day keeps its failure and nothing counts twice.
- The morning digest lists overdue habits and the reminder counts them.

## [2.7.1] - 2026-10-13

### Fixed

- The mobile month-day picker keeps each chosen day a separate square, and "Todo ano" pages through months with arrows.

## [2.7.0] - 2026-10-12

### Added

- Mobile history insights: habit filter, weekly trend, year highlights and per-habit rows.
- Calendar-style pickers for days of the month and yearly habits; light motion (press, day fade, reorder slide).

### Fixed

- The tab bar sits above the Android navigation buttons; shorter name placeholder.

## [2.6.0] - 2026-10-12

### Added

- Mobile tabs Hoje (opened first, with a strip of the last 7 days), Histórico and Hábitos, with Ajustes behind a gear.
- Habit cards with a reorder mode on the mobile (offline).

### Changed

- Every mobile screen uses the new visual identity; toasts sit above fixed footers.

### Removed

- The old color palette and its token names.

## [2.5.0] - 2026-10-12

### Changed

- Redesigned mobile home screen: the new visual identity and display font, overview numbers, a one-handed layout with a "Hoje" panel, a GitHub-style grid with an entrance animation, and new loading, empty and error states.

## [2.4.0] - 2026-10-12

<!-- verify: the first redesign commit (dc5e876) still carried 2.3.0; the version was bumped in 9503f5f -->

### Added

- User-defined habit order: drag, keyboard or buttons on the web (database migration `0006`).
- Overview numbers on the heatmap (runs of strong days, week and month), a "Hoje" panel and a keyboard-navigable grid with a tooltip.
- Esc and ←/→ on the day screen; settings parity with the mobile (today's date, one-click device time zone, sign-out confirmation).

### Changed

- Redesigned web app with the new visual identity and display font, habit cards and centered reading screens.

## [2.3.0] - 2026-10-12

### Added

- Edit past days up to 30 days back after a confirmation, and "Desfazer" after every change.

## [2.2.0] - 2026-10-11

<!-- verify: year navigation (a40e375) landed in a separate commit after a27f06e, still as 2.2.0 -->

### Added

- Flexible schedules: every N days, days of the month, a single date and yearly.
- "Próximos" on today, a morning digest at 09:00 and an option to hide habit names in notifications.
- Year navigation on the heatmap.

### Changed

- Reminder times move to 15-minute steps (database migration `0005`).

## [2.1.0] - 2026-10-11

### Added

- Create a habit from today's view (web dialog, mobile bottom sheet, offline on the mobile).

### Changed

- The app version is left out of the mobile build fingerprint, so version bumps alone still reach installed builds over the air (this change itself needed a new build).

## [2.0.0] - 2026-10-11

<!-- verify: the tag v2.0.0 points at 5ce71d4; the legacy removal (459b407) and the mobile build workflow (1436969) still carried 2.0.0 after it -->

### Added

- Complete rewrite as a monorepo: Hono API on Cloudflare Workers with D1, React PWA and an Expo Android app sharing contracts and domain logic.
- Single-owner authentication, Web Push and Expo push reminders, and offline-first sync on the mobile.
- CI/CD with GitHub Actions, D1 backups to R2 and production deploy.

### Removed

- The legacy app (kept in the git history).

### Security

- Legacy hardcoded VAPID keys are no longer used; production keys are generated per instance and kept as secrets.

[Unreleased]: https://github.com/Ranieeery/Habits-tracker/compare/v2.16.2...HEAD
[2.16.2]: https://github.com/Ranieeery/Habits-tracker/compare/v2.16.1...v2.16.2
[2.16.1]: https://github.com/Ranieeery/Habits-tracker/compare/v2.16.0...v2.16.1
[2.16.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.15.0...v2.16.0
[2.15.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.14.1...v2.15.0
[2.14.1]: https://github.com/Ranieeery/Habits-tracker/compare/v2.14.0...v2.14.1
[2.14.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.13.0...v2.14.0
[2.13.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.12.0...v2.13.0
[2.12.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.11.0...v2.12.0
[2.11.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.10.1...v2.11.0
[2.10.1]: https://github.com/Ranieeery/Habits-tracker/compare/v2.10.0...v2.10.1
[2.10.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.9.0...v2.10.0
[2.9.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.8.1...v2.9.0
[2.8.1]: https://github.com/Ranieeery/Habits-tracker/compare/v2.8.0...v2.8.1
[2.8.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.7.1...v2.8.0
[2.7.1]: https://github.com/Ranieeery/Habits-tracker/compare/v2.7.0...v2.7.1
[2.7.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/Ranieeery/Habits-tracker/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Ranieeery/Habits-tracker/compare/legacy-1.x...v2.0.0
