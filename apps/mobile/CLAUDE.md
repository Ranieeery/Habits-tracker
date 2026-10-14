# apps/mobile

Expo (SDK 57) + Expo Router, the primary client (target: Android). See the root `CLAUDE.md` for architecture and design rules, and `AGENTS.md` (Expo template) for Expo-specific guidance: always check the versioned Expo docs before using an Expo/RN API.

## Running it

A development build is required (not Expo Go): secure storage, haptics, push, SQLite and background tasks need native modules. **Phase 7 added native modules** (expo-sqlite, expo-background-task, expo-task-manager, expo-crypto): builds made before it do not have them, so build again.

1. `cp apps/mobile/.env.example apps/mobile/.env` and pick the API (see below). `EXPO_PUBLIC_API_URL` is inlined by Metro, so changing it needs a Metro restart, not a new build.
2. Build and install the development APK once (again only after adding a native dependency or changing a config plugin in `app.json`):
   - **EAS Build (recommended, no Android SDK needed):** from the repo root, `gh workflow run mobile-build -f profile=development` (GitHub Actions, Linux). Since expo-updates (Phase 8) the build compares fingerprints, and `eas build` started from Windows fails with "Runtime version mismatch" (pnpm folder names differ); from Linux, macOS or WSL, `cd apps/mobile` and `pnpm dlx eas-cli@latest build --profile development --platform android` works. The first run links an Expo project (writes `extra.eas.projectId` to `app.json`). Install the APK from the QR code/link.
   - **Local:** `pnpm --filter mobile exec expo run:android`. Needs JDK 17 (`JAVA_HOME`), Android Studio with SDK Platform 36, `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`, `platform-tools` on `Path`, and Windows long paths enabled. `android/` is generated (CNG) and gitignored: never edit it.
3. `pnpm --filter mobile start` and open the app on the phone.

### Push notifications (Android)

Push tokens need Firebase, and both steps below change the native app (new development build):

1. Firebase console: create a project, add an Android app with package `com.rxniery.habits`, download `google-services.json` to `apps/mobile/` (public identifiers, commit it; `app.config.js` only references it when the file exists).
2. Firebase > Project settings > Service accounts > Generate new private key; upload it with `eas credentials` (Android > Google Service Account > FCM V1). That JSON is a secret: never commit it.
3. Rebuild the development build (`gh workflow run mobile-build -f profile=development`).

Permission is asked only when reminders are turned on in Ajustes. Without Firebase, enabling reminders reports this device as unavailable; Web Push devices and the rest of the app keep working.

### Production builds and OTA updates (Phase 8)

- `expo-updates` with `runtimeVersion: { policy: "fingerprint" }` and `updates.url` in `app.json`; the app checks on launch and applies a downloaded update on the next launch.
- `eas.json` profiles: `development` (dev client), `preview` and `production` (internal APKs, channels `preview` and `production`, EAS environments of the same names, `EXPO_PUBLIC_API_URL` from the EAS environment; `production` auto-increments `versionCode`, `appVersionSource: remote`). All share the package `com.rxniery.habits`, so installing one replaces the other.
- **New build vs OTA**: native dependencies, config plugins, native `app.json` fields (permissions, icons, splash, package, plugins), `google-services.json` or the Expo SDK change the fingerprint and need `eas build`; JS/TS and assets go out as `eas update`. The `deploy` workflow publishes the update on channel `production` after the API is deployed, only when `apps/mobile`, a package it uses or the lockfile changed. Every update must work with the production API and with older outboxes (additive contracts only).
- Credentials: Android keystore and FCM V1 key live in EAS (`eas credentials`); the owner keeps a keystore copy outside the repo. Never commit `credentials.json`, keystores or the service account JSON (`.gitignore` covers them).
- First production build, install, updates and rollback (`eas update:rollback`): `README.md`, "Mobile: builds e updates (EAS)".

### Pointing at an API

- **Local, USB (recommended):** `pnpm --filter api dev`, phone on USB with debugging on, `adb reverse tcp:8787 tcp:8787` and `adb reverse tcp:8081 tcp:8081` (Metro), `EXPO_PUBLIC_API_URL=http://localhost:8787`. Sign in as `dev@habits.local` / `habits-dev-password` after `db:seed:local`.
- **Local, Wi-Fi:** `pnpm --filter api dev -- --ip 0.0.0.0`, `EXPO_PUBLIC_API_URL=http://<PC LAN IP>:8787` (debug builds allow cleartext HTTP).
- **Production:** `EXPO_PUBLIC_API_URL=https://habits.rxniery.workers.dev/api` (the public gateway; `habits-api` has no URL of its own).

The value is the API base without `/v1` and without a trailing slash. The API already trusts the `habits://` origin (Better Auth `expo()` plugin), so no server change is needed per environment.

## Layout

- `src/app/`: routes only (thin files re-exporting screens). `_layout.tsx` gets the services (`getServices()`), creates the QueryClient, wires the sync engine's events to it (data changed → invalidate, settings changed, 401 → sign out keeping the database), imports `data/sync/background.ts` (the task must be defined at module scope), keeps the splash up while the session is restored, and switches between `login` and `(app)` with `Stack.Protected`. `(app)/_layout.tsx`: `InitialSyncGate` (starts the sync triggers; until the first full pull of this user finishes it shows its progress, or an offline/error state, instead of the app), then `SettingsGate` (the user's settings, from the local copy). Tabs (2.6.0, the web's order): `(app)/(tabs)/index` (Hoje, path `/`, opened first), `history` (the heatmap), `habits`. Stack screens: `settings` (behind the gear of `features/shell/tab-header.tsx`), `day/[date]` (`YYYY-MM-DD`, or `hoje` for old links; days opened from the heatmap), `habit/new`, `habit/[id]`, `sync` (modals). Notifications carry `/day/hoje`; `notificationPath` turns it into `/` and the responder uses `router.navigate`.
- `src/data/`: the only layer that knows where data comes from. `repository.ts` (domain interface), `remote-repository.ts` (HTTP via `@habits/api-client`: settings, push devices, and the cookie-authenticated `fetch`), `errors.ts` (`DataError` kinds and pt-BR messages), `auth.ts` (Better Auth + `expoClient`), `hooks.ts` (TanStack Query hooks the screens use, sync hooks re-exported), `today.ts` (`useToday`, settings context), `services.ts` (one instance per JS context via `getServices()`; the only `Date.now()`, device time zone and id generator; `prepareLocalData` binds the database to the signed-in user), `query-client.ts` (`networkMode: "always"`: data is local), push: `push.ts`, `push-logic.ts` (pure), `push-registration.ts`, `push-hooks.ts`, and `NotificationsRepository` in `repository.ts` (remote: push needs the server).
- `src/data/local/`: the device database. `sql.ts` (minimal `SqlDatabase` interface), `expo-sql.ts` (expo-sqlite, `withExclusiveTransactionAsync`; since 2.6.0 transactions run one at a time per JS context through `serial.ts`, since each exclusive transaction opens its own connection and two at once failed with database is locked, plus `busy_timeout` for the background task), `migrations.ts` (versioned schema by `PRAGMA user_version`: append, never edit a shipped version; version 2 (2.4.0) adds `habits.sort_key`, version 3 (2.12.0) `habits.description`), `store.ts` (all SQL: server mirror, outbox, meta, lease), `local-repository.ts` (the `HabitsRepository` the app uses: reads `materialize(mirror, outbox)` from core and builds day/year views with core's `dayView`/`summarizeYear`; writes one outbox mutation and call `notifyLocalWrite`; habits are listed and shown in the user's order (core `sortHabits`), and a new habit gets `keyAfterLast` so it is last before it syncs; settings from the local copy). `testing/` is for Vitest only: `node-sql.ts` (`node:sqlite` adapter), `fake-server.ts` (in-memory server on core's rules).
- `src/data/sync/`: `engine.ts` (push → pull → settings, lock + lease, backoff with jitter, status for the UI), `transport.ts` (requests with a 20 s timeout, error classification, `Date`/`Retry-After` headers), `triggers.ts` (`useSyncTriggers`: launch, foreground, network via `expo-network`, every 5 min, background registration after the first sync), `background.ts` (`habits-sync` task, expo-background-task), `failures.ts` (pt-BR descriptions of refused changes), `hooks.ts`.
- `src/features/sync/`: `initial-sync-gate.tsx`, `sync-indicator.tsx` (heatmap header and Ajustes), `sync-screen.tsx` (status, "Sincronizar agora", clock warning, failures with "Tentar de novo"/"Descartar").
- `src/features/notifications/notification-responder.tsx` (in the authenticated layout): registers the token, handles taps (also from a cold start) by opening `/day/hoje`, and shows foreground notifications as a toast (the handler hides the banner and sound).
- `src/features/<screen>/`: screens and their components. `features/day/edit-day-sheet.tsx` (2.3.0): `EditDayFooter`, the footer of a past day inside the window: "Editar este dia" opens a confirmation bottom sheet (Modal, Cancelar focused, back/tap outside cancel), then the same footer is "Concluir edição"; the day screen shows the `warning` notice "Editando dia passado" on top of the list, keeps the unlock in component state (keyed by date; the background keeps it), and shows "Desfazer" after every change through `useToast` options (an action, 6 s; `useDismissToast` removes it when the day locks or the screen closes). `features/day/new-habit-sheet.tsx`: today's "Novo hábito" (the day screen's fixed footer, full width: one-handed reach, never over the list) opening a bottom sheet (React Native `Modal` + keyboard-controller's `KeyboardAvoidingView`, no sheet library) with the same `HabitForm` as the habits tab; one id per opening (`useNewId`), written to the outbox like any habit (works offline); when the habit does not count today, a toast with core's `newHabitNotice`. `src/ui/`: shared primitives (Button, TextField, states, Toast, Screen with an optional fixed `footer` (reported to the toast while focused, so toasts sit above it: `useToastAnchor`, `lib/toast-position.ts`) and a `background` layer (`ui/backdrop.tsx`), `motion.ts` (pulse/release), `CheckboxBox` (animated), splash, `fonts.ts` + `DisplayText` (display face), `Wordmark`, `useReducedMotion` (live `AccessibilityInfo`), `Choice` chips, `DatePicker` (inline month calendar, 44 dp days, no native picker) and `QuarterTimePicker` (hour -/+ and minutes 00/15/30/45)). `features/habits/habit-form.tsx` renders core's `habit-draft.ts` ("Repetição", fields per kind, "Começa em", preview, an `Alert` before changing a repetition); `features/day/upcoming-section.tsx` is "Próximos" on today; the habits tab shows `formatSchedule`, a collapsible "Passados" and "Incompatível". `features/today/` (2.6.0): `today-screen.tsx` is the Hoje tab (`TabHeader`, `TimezoneBanner`, `week-strip.tsx` from `week-strip-model.ts`, then `DayView` with `inTabs`; the chosen day is memory only and resets when the tab loses focus). `features/heatmap/` (`DESIGN.md` "Mobile"): `heatmap-screen.tsx` is the Histórico tab (`TabHeader`, date, `overview-strip.tsx` from core's `overviewStats` with the previous year's summary only when `overviewNeedsPreviousYear` says so, year arrows within core's `heatmapYearRange`, the grid and legend; today's cell opens the Hoje tab); `heatmap-grid.tsx`: horizontal `FlatList` of week columns keyed by year (a past year opens at its end), 28 dp days in 32 dp slots, one `Pressable` and one `adjustable` accessibility element per week (`dayIndexAt`, `stepDay`, `weekLabel`, `dayValue` in `heatmap-layout.ts`), press highlight, columns memoized on `weekSignature`, entrance sweep and today's pulse with Reanimated; `heatmap-states.tsx` (breathing skeleton, empty, error); 2.10.0: `day-preview-bubble.tsx` (hold a square to see its day; gesture in `heatmap-grid.tsx`, `cellAt`/`previewLines`/`bubbleLeft` in `heatmap-layout.ts`); 2.7.0: `habit-filter.tsx`, `trend-section.tsx`, `highlights-section.tsx`, `per-habit-section.tsx` and `insights-format.ts` (see "History insights" in the root `CLAUDE.md`). `features/day/`: `DayView` (exported; the `day/[date]` route and the Hoje tab), `use-day-items.ts` + `day-items-list.tsx` (2.8.0: the reusable rows of a day; on today, "today's items" with the overdue habits first, which `local-repository.ts` `getDay` adds through core's `todayView` over the local data of `overdueRange(today)`, offline), `habit-row.tsx` (one row in a `night-surface` panel; 2.13.0: the deadline badge `due` (`deadlineLabel`) and `doneOn` ("Já concluída em", checkbox off), with the "Com prazo" header in `day-items-list.tsx`; 2.12.0: the note icon when the habit has a description, opening `features/habits/description-sheet.tsx`, whose "Abrir descrição completa" leads to `habit/about/[id]` (`habit-about-screen.tsx`, rendered by `ui/description-text.tsx`); optional overdue badge below the name, label "Nome, atrasado desde …"), `use-completion-change.ts` (toggle with haptic and "Desfazer"). `features/habits/habit-card.tsx`: cards like the web's; `habit-screens.tsx` edit screen: "Arquivar", or for an archived habit "Desarquivar" and "Apagar hábito" (2.11.0, `useDeleteHabit`/`useRestoreHabit`, "Desfazer" in the toast); the Hábitos tab has "Novo hábito" in its footer and a "Reordenar" mode (up/down through `useReorderHabit`). `src/lib/`: pure helpers (dayjs pt-BR formatting and `capitalizeFirst`, `withAlpha` (`color.ts`), time zone banner rule, `calendar.ts` for the time picker; the month calendar logic is core's `calendar.ts`, shared with the web).

## Rules

- Screens never import `@habits/api-client` or call `fetch`; they use the hooks in `src/data/hooks.ts`. Date, schedule, ratio, level and grid logic comes from `@habits/core` only.
- The session cookie lives only in expo-secure-store, managed by the Better Auth Expo plugin (`storagePrefix: "habits"`); API calls send it as a `Cookie` header with `credentials: "omit"`. Never use AsyncStorage for it and never log headers, cookies or session data.
- Any `unauthorized` error from a query, mutation or sync signs out (clears SecureStore) and the guard shows the login; the device database is kept for the same user. Network failures never sign out. "Sair" in Ajustes wipes the database after warning about unsynced changes; a different user signing in wipes it before anything shows.
- Screens never touch the database, the outbox or the sync engine directly: hooks only (`useSyncStatus`, `useSyncFailures`, ...). Habit and completion writes are local and instant; only settings and push need the network.
- Colors only from `@habits/design-tokens`: Tailwind classes from the preset, or token objects for style props NativeWind does not cover (navigation options, icons, heatmap cells, `boxShadow`), with alpha only through `withAlpha` on a token. No hex literals in `src/`. The preset equals the web's and since 2.6.0 has only the `night` set: `night-*` classes and `nightColors`; `src/tokens-guard.test.ts` fails on the removed names (`bg-surface`, `colors.muted`…).
- Display text (numbers, year, panel titles, mark) uses `DisplayText` (Bricolage, `ui/fonts.ts`), never `font-display` (on Android the family name is per weight); other text stays in the system font. Motion uses Reanimated (`.get()`/`.set()` on shared values, React Compiler) and stops with `useReducedMotion()`.
- NativeWind `className` works on React Native core components; for third-party ones (SafeAreaView, KeyboardAwareScrollView, Reanimated views) use `style` or wrap a core `View`.
- Touch targets >= 44 dp (`min-h-touch`, `size-touch`); forms live inside `Screen` (keyboard-aware scroll, needed because Android is edge-to-edge).
- Tests: Vitest for modules without React Native imports (`src/**/*.test.ts`, node environment); no component tests. The local store and the sync engine run their real SQL on Node's `node:sqlite` in memory (`data/local/testing/`), against a fake server built on core's sync rules. `pnpm --filter mobile test`.

- Add native/Expo packages with `pnpm exec expo install <pkg>` so versions match the SDK; check with `pnpm dlx expo-doctor`.
- Styling: NativeWind 4 (Tailwind v3). `tailwind.config.js` uses the preset from `@habits/design-tokens/tailwind-v3-preset`; `src/global.css` is wired in `metro.config.js` and `babel.config.js`. `react-native-css-interop` is a direct dependency and must match the version `nativewind` pins. `@babel/plugin-transform-react-jsx` is a devDependency only because the NativeWind/css-interop preset loads it by name without declaring it (a clean install cannot resolve it otherwise); keep it.
- Version (`2.13.0`) is in both `package.json` and `expo.version` in `app.json`, the same as api and web; bump them together with every change (policy in the root `CLAUDE.md`). `fingerprint.config.js` keeps the versions out of the runtime fingerprint; `versionCode` is managed by EAS (remote, auto-incremented).
- Native colors in `app.json` (window, splash, adaptive icon background, notification color) must equal `nightColors` (`src/app-config.test.ts`); the icon and splash PNGs come from `pnpm --filter @habits/design-tokens brand` (2.9.0), never edited by hand, and any change to them needs a new build.
- `*.config.js` files are CommonJS (ESLint override in `eslint.config.mjs`); the Vitest config is `vitest.config.mts` because the package is CommonJS.

## Manual checks (2.13.0: deadline tasks)

Pending, after the deploy (API, web, then the OTA). Confirm in Ajustes that the phone runs 2.13.0 **before** creating the first task (the app pulls everything again once after the update). To simulate dates locally: `pnpm --filter api db:seed:local --today <date>` (the seed's "Entregar relatório (teste)" is due 7 days after it).

1. Hoje > "Novo hábito" > "Até uma data": no "Começa em", the calendar starts today and stops 2 years ahead, the summary says "Pode ser concluído até DD/MM. Se passar do prazo, fica atrasado.". Create one due in 7 days: it shows under "Com prazo", after the day's habits, with "Até DD/MM · faltam 7 dias" (TalkBack reads it with the name).
2. Mark it today: haptic, the progress goes from "N de M" to "N+1 de M+1"; "Desfazer" brings it back. Marked, open another day on the strip and come back: it shows only today (checked), and not the next day.
3. Create another due tomorrow: "Vence amanhã"; the next day "Vence hoje" (warning tone) and it counts in today's progress; leave it open: the day after, it is first under the overdue habits with "Atrasado desde DD/MM", and the due day on the heatmap keeps the failure.
4. Mark the overdue task: it counts today, the due day still shows the failure; open the due day from Histórico: "Já concluída em DD/MM", no checkbox, even after "Editar este dia".
5. Hábitos: the card shows the deadline icon, "Até DD/MM" and the badge; done tasks move to "Passados"; editing a task whose due date passed shows the date read only with the note.
6. Airplane mode: create a task and mark it; both show at once and sync back online; the web shows the same.
7. Digest at 09:00: on the day before, "Vence amanhã: X."; on the day, "Vence hoje: X." (with names hidden: "Você tem compromissos hoje/amanhã."). The reminder counts the task only on its due date or while overdue.
8. Old app (2.12.x, before the OTA) against the new API: it keeps syncing and never shows the tasks (nothing breaks).

## Manual checks (2.12.0: habit descriptions)

Pending, after the deploy (backup, `0007`, API, web, then the OTA). Confirm in Ajustes that the phone runs 2.12.0. Use a test habit.

1. Hábitos > edit a habit: "Descrição (opcional)" below the name, several lines, the hint about **negrito**, _itálico_, lists and links. Save a description with a bold word, a list of 6 items and a link.
2. Hoje: the habit's row shows the description's first line under the name (one line, cut with …) and the note icon at the right; other habits show neither. The dev seed's "Rotina da noite (teste)" has a long description ready. Tapping the row still marks it; tapping the icon does not.
3. The icon opens a sheet: the name, the first lines (bold in bold, a bulleted list) and "Abrir descrição completa"; the link opens the browser.
4. "Abrir descrição completa": the habit screen (header panel with the week strip and badge, "Descrição" panel, both fading in; nothing moves with "Remover animações") with the whole text and "Editar" in the footer; "Editar" opens the edit screen with the text.
5. A short description (one line): the sheet shows it whole, without "Abrir descrição completa".
6. TalkBack: the icon reads "Descrição de …", the row still reads as a checkbox.
7. Airplane mode: change a description; it shows at once and syncs back online; the web shows it.

## Manual checks (2.11.0: deleting habits)

Pending, after the deploy (API, web, then the OTA). Confirm in Ajustes that the phone runs 2.11.0. Use a test habit (the phone has real data).

1. Hábitos: the edit screen of an active habit has "Arquivar" and no "Apagar". Archive the test habit: its edit screen now has "Desarquivar" and "Apagar hábito".
2. "Apagar hábito": the alert says the history leaves the map; "Cancelar" (and Android back) keeps it.
3. "Apagar": back on Hábitos, the habit is gone from "Arquivados", a toast "Hábito apagado" with "Desfazer"; Histórico no longer counts it on its past days.
4. "Desfazer" within 6 s: it is back in "Arquivados" and the past days count it again.
5. Airplane mode: delete, see it gone at once (pending change), reconnect: it syncs and the web no longer lists it.
6. Web: "Arquivados" shows a trash button per habit; the dialog starts on "Cancelar", Esc closes it; deleting removes it, "Desfazer" restores it.

## Manual checks (2.10.1: new habit sheet and keyboard)

1. Hoje > "Novo hábito", tap the name field: the keyboard opens, the sheet stays below the status bar with its title, and the name field is visible right above the form; the rest of the form scrolls inside the sheet above the keyboard (no gap the size of the navigation bar).
2. Close the keyboard: the sheet goes back to its normal height, above the navigation bar. Hábitos > "Novo hábito" (a full screen) works as before.

## Manual checks (2.10.0: heatmap day preview)

Pending, after the deploy (API and web carry only the version, then the OTA; same fingerprint as 2.9.0, so the phone needs the 2.9.0 build first). Confirm in Ajustes that the phone runs 2.10.0.

1. Histórico: a quick tap on a past square still opens that day; tapping today still opens Hoje.
2. Hold a past square (~0.3 s): a bubble appears above the finger with the date ("Qui, 8 de out") and "N de M · P%"; the square gets the violet ring. Lift: the bubble closes and no day opens.
3. Hold and slide across the grid, also sideways over other weeks: the bubble and the ring follow the day under the finger; the grid does not scroll meanwhile. Over future days or the padding days before January 1 the bubble hides and comes back on a valid day.
4. Normal swipes (without holding) still scroll the year horizontally, and a quick swipe never shows the bubble.
5. Top rows (Sunday, Monday): the bubble stays whole, over the year arrows. First and last visible columns: the bubble stays inside the screen, the arrow still points at the square.
6. A day without habits says "Nenhum hábito previsto"; with a habit chosen in the filter chips: "Feito", "Não feito" or "Sem previsão".
7. Reduced motion on: the bubble appears without fading. TalkBack: the grid reads and opens days as before (the bubble is not announced).
8. Font scale 1.15 and 1.3: the bubble's two lines fit.

## Manual checks (2.9.0: app icon and splash)

Pending, on a **new production build** (the fingerprint changed; an OTA cannot bring native icons). After the deploy: `gh workflow run mobile-build -f profile=production`, install the APK over the current one (same package: data kept), confirm in Ajustes that it runs 2.9.0.

1. Launcher: the icon is the four squares on the dark background (no "habits" text), whole in round, squircle and square shapes (change the icon shape in the launcher settings if available).
2. Themed icons on (Android 13+, Wallpaper & style > Themed icons): the four squares in the system tint.
3. Cold start (swipe the app away, open it): the splash shows only the mark on the dark background, then the app fades in; no white flash, no old "habits" text.
4. "Enviar notificação de teste" in Ajustes: the status bar shows the white squares; the notification accent is violet.
5. Recent apps and app info show the new icon.
6. Web: the tab shows the new favicon (light and dark browser themes); install the PWA on Android (new icon, no white border) and "Adicionar à Tela de Início" on the iPhone.

## Manual checks (2.8.0: overdue habits)

Pending, after the deploy (API, web, then the OTA: no migration, same fingerprint `e40c9bd…` before and after on Windows). Confirm in Ajustes that the phone runs 2.8.0. To simulate dates locally: `pnpm --filter api db:seed:local --today <date>` (the seed's single date is two days after it, so it is overdue from the third day) or a habit created days before; for the cron, `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*/15+*+*+*+*&time=<ms>"`.

1. Create "Pagar condomínio" on day 15 (Dias do mês) before the 15th and do not mark it. On the 16th, Hoje (phone) and the web's /today and "Hoje" panel show it first with "Atrasado desde 15/10" (icon and text); TalkBack reads "Pagar condomínio, atrasado desde 15 de outubro". Past days on the strip and the heatmap, and tomorrow, show no badge; weekday habits never have one.
2. Mark it on the 16th: haptic, it stays first, checked, with the badge; "Desfazer" brings it back to pending. Mark it again: the heatmap keeps the failure on the 15th and counts it as done on the 16th (the cell gets brighter); the progress goes from "N de M" to "N+1 de M+1".
3. Leave it unmarked past the limit (seed, or a habit whose day was 16 days ago): on day O+16 it is gone from Hoje and the 15th keeps the failure. With only overdue habits pending today, the list shows "Nada previsto para hoje além dos atrasados." instead of a "0 de 0" bar.
4. A habit on days 10 and 20 missed on the 10th: on the 20th only the normal item (no badge); on the 21st the badge says "desde 20/10".
5. Airplane mode: mark and unmark an overdue habit on the phone; it updates at once and the indicator shows pending changes; back online it syncs and the web shows the same.
6. Digest at 09:00 with an overdue habit: "… 1 atrasado: Pagar condomínio." With "Mostrar nomes nas notificações" off: "Você tem … 1 hábito atrasado." (no names). The reminder at its time counts it ("Você tem N hábitos pendentes hoje.") and stops counting it once marked.
7. Old app (2.7.x, before the OTA) against the new API: it keeps syncing and shows no overdue habits (nothing breaks); its notifications may already mention them.

## Manual checks (2.7.0: history insights, pickers, motion)

Pending, after the deploy (OTA, same fingerprint). Confirm in Ajustes that the phone runs 2.7.0.

1. Tab bar: the labels are whole, with room above the Android buttons (also with gesture navigation).
2. New habit: the name placeholder fits one line; "Dias do mês" shows the calendar-style grid (full width), and several neighbor days chosen side by side stay separate squares; "Todo ano" is a month calendar with arrows (December → January wraps), only that month's days (February up to 29), and the chosen day stays marked only in its month.
3. Press a button, a chip, a strip day or a habit card: it sinks a little; with reduced motion nothing moves.
4. Hoje: switching days on the strip fades the list in. Hábitos: "Reordenar" and move a habit: the cards slide (the order only sticks once the API with migration 0006 is deployed).
5. Histórico: the filter row, then the grid; a chip makes the grid, the numbers and the sections about that habit (the title shows its name); leaving the tab resets it.
6. Below the grid: "Tendência" (12 bars, one sentence), "Destaques" (only what applies), "Por hábito" (a tap filters and scrolls up; "Ver todos" with more than 5). The screen still reads as the heatmap first; check at font scale 1.15 and 1.3.

## Manual checks (2.6.0: tabs, Hoje strip, every screen on night)

Pending, after the deploy (API and web carry only the version, then the OTA update; no new build: same fingerprint). Confirm in Ajustes that the phone runs 2.6.0.

1. Cold start opens **Hoje**: the strip of the last 7 days (today with a dot), today's list in a panel, "Novo hábito" fixed at the bottom; the tab bar shows Hoje · Histórico · Hábitos with a pill behind the active icon.
2. Mark and unmark on Hoje: haptic, the box pulses (check) or dips (uncheck), the fill fades; "Desfazer" appears just above "Novo hábito", never over it.
3. Strip: tap yesterday: its list opens read-only with "Editar este dia" in the footer; confirm, mark, undo, "Concluir edição". Tap another day: locked again. Switch to Histórico and back: the strip is on today again.
4. A reminder or digest notification (or one sent before the update): a tap opens the Hoje tab, also from a cold start.
5. Histórico: tapping a past day opens its day screen (back returns); tapping today switches to Hoje.
6. Hábitos: cards with the week strip and "Hoje"/"Próxima"; "Reordenar" shows up/down arrows; move a habit, finish: the new order shows on Hoje and, after a sync, on the web. Offline too (airplane mode), then it syncs.
7. The gear on each tab opens Ajustes with a back arrow; Ajustes looks as before (only colors), sign-out and the time zone still work.
8. Login (sign out on a test account or check after a session expires): the mark, the glow and the "Entrar" title.
9. Big system font and reduced motion, as in 2.5.0 (items 6 and 7 below), on every tab.

## Manual checks (2.5.0: redesigned home screen)

Pending, after the deploy (API and web carry only the version, then the OTA update; no new build: same fingerprint). Confirm in Ajustes that the phone runs 2.5.0.

1. Cold start (swipe the app away, open it): the splash stays until the screen is ready, no white flash, the year and the numbers already in Bricolage (no font swap).
2. Heatmap: opens on the current week near the right edge; scroll horizontally to January and back, smooth; month and weekday labels line up with the rows (Saturday included).
3. Touch: press a past day and hold: the violet ring marks it; slide away and release: nothing opens; tap it: its day screen opens. Today opens "Hoje" (`/day/hoje`). Future days do nothing. Tap the gap between two cells: one of them opens, never nothing.
4. "Hoje" panel: mark a habit: haptic, checkbox pulse, today's cell pulses and changes level, the numbers update, "Marcado: …" with "Desfazer" for about 6 s; "Desfazer" restores it. "Abrir o dia de hoje" opens the day with "Próximos" and "Novo hábito".
5. Airplane mode: mark and unmark in the panel; everything updates at once and the indicator shows "Offline · N pendentes". Network back: "Sincronizando…" then "Sincronizado às HH:MM", and the web shows the change.
6. Big system font (Settings > Display > Font size at the maximum): the four numbers stay in one row (labels may take two lines), the sync state wraps below the mark, the grid labels stay inside their rows, nothing cut off or overlapping.
7. Reduced motion (Settings > Accessibility > Visibility enhancements > Remove animations): no sweep on opening, no pulse, no skeleton breathing; turning it off while the app runs brings the motion back.
8. TalkBack: the grid reads "Semana de 4 a 10 de outubro" and the chosen day ("sexta-feira, 9 de outubro de 2026 (hoje): 3 de 5 hábitos concluídos (60%)"); swipe up/down changes the day (skips future days); double tap opens it. Panel rows read as checkboxes.
9. Small screen (or Settings > Display > Screen zoom at the maximum): the panel still starts in the lower part, the arrows and rows keep 44 dp targets.
10. Other screens with the new palette (not redesigned): day (rows, past-day notice, "Editar este dia" sheet), habits (list, form chips, calendar, time picker), Ajustes (switches, time zone, sign-out sheet), sync screen and login: all text readable, pressed/disabled/error states visible, the primary button text white on violet, the check icon dark on green.
11. Year arrows: a past year opens at December, only "Melhor em" follows the year; the other numbers stay on today.

## Manual checks on the device (Phase 7)

Pending, on a new development build with the API migrated (`db:migrate:local` or `db:migrate:remote`):

1. Initial sync: sign in with an empty device and watch "Baixando seus dados…" with progress; with airplane mode on (or the API down) the gate says so, and recovers by itself when the network/API returns.
2. Airplane mode: mark and unmark habits, create and edit a habit; the screens update at once and the indicator shows "Offline · N pendentes".
3. Close the app with pending changes (swipe it away), reopen offline: the changes are still there and still pending.
4. Reconnect: the indicator goes to "Sincronizando…" then "Sincronizado às HH:MM", and the web shows the changes.
5. Two devices (or the phone and the web) changing the same day: the one that syncs last wins; afterwards both show the same state, with one completion row on the server.
6. Wrong phone clock (turn off automatic time, move it a few days): marking "today" ends in "Falhas" as out of the editable period when outside the window, and the sync screen warns about the clock.
7. Sign out with pending changes: the warning lists them; "Sincronizar e sair" sends them first; "Sair mesmo assim" wipes them. Signing in as another user never shows the previous user's data.
8. Background: with the app closed, change something on the web and wait (at least 15 minutes, OS-scheduled); reopening shows it without a visible sync. In a development build, Sincronização > "Rodar a tarefa em segundo plano (debug)" runs the task at once (`triggerTaskWorkerForTestingAsync`).
9. Failures: create a habit offline, keep the phone offline for more than 30 days (or move the clock): the creation and its completions appear grouped in "Falhas"; "Descartar" removes them all.

## Manual checks (2.3.0: editing past days)

Pending, after the deploy (API, web, then the OTA update; no new build: the fingerprint did not change). Confirm in Ajustes that the phone runs 2.3.0.

1. Open a day 5 days back from the heatmap: read-only, "Editar este dia" in the footer (one thumb, never over the last habit). Tap it: the sheet asks "Editar o dia DD/MM?"; TalkBack starts on "Cancelar". Cancel (button, Android back and tap outside): still locked.
2. Confirm "Editar": "Editando dia passado" on top, the footer says "Concluir edição", checkboxes work without asking again. Mark and unmark; the heatmap cell and the progress follow. "Concluir edição" locks it again.
3. Repeat with a day 25 days back. A day 40 days back: no button, "Fora do período de edição de 30 dias". Tomorrow: read-only, no button. A past day without habits: no button.
4. Unlock a day, go back to the heatmap and open it again (or another day): locked. Unlock, send the app to the background and come back: still unlocked. Close the app and reopen: locked.
5. Desfazer: on today and on an unlocked past day, mark a habit: "Marcado: …" with "Desfazer" for about 6 s (TalkBack announces it); "Desfazer" restores it. Two quick changes: only the last one can be undone.
6. Airplane mode: unlock a day 10 days back, mark it and undo something; the indicator shows pending changes. Reconnect: it syncs and the web shows the same day.
7. Against the 2.2.0 API (before deploying it, or a local API at the old commit): mark a day 10 days back; the change ends in "Falhas" with "Fora do período editável (a partir de DD/MM)" and the day returns to the server state; after the API deploy, "Tentar de novo" applies it.
8. Web (desktop and phone): the same flow with the dialog (Esc closes, Tab stays inside, focus starts on "Cancelar"); reload the page while unlocked: locked again.

## Manual checks (2.2.0: flexible schedules and morning digest)

Pending, after the deploy (migration, API, web, then the OTA update; no new build: the fingerprint did not change). Confirm in Ajustes that the phone runs 2.2.0 before step 2.

1. Old app with the new API: before the OTA reaches the phone, the 2.1.0 app keeps syncing (habits of new types are simply absent) and the web still works. After the update, the app pulls everything again once and the new habits appear.
2. Create "Consulta no dermatologista" as a single date two days from today (web or phone). The next day at 09:00 (until 12:00) the digest says "Amanhã: Consulta no dermatologista"; on the day, at 09:00, it is in "Hoje: …". Tapping opens today (`/today` on the web, `/day/hoje` on the phone).
3. Create "Trocar filtro" every 8 days and "Pagar condomínio" on day 20: the form shows the summary and the next date; the day views and "Próximos" show them on the right days; the habits list shows "A cada 8 dias" and "Todo dia 20".
4. Create a habit offline (airplane mode) with a single date tomorrow; reconnect before 09:00 and the digest includes it. Created and not synced, it is not in the digest (documented).
5. Reminder time: only 00, 15, 30 and 45 can be chosen; the reminder arrives within 15 minutes of it, only with pending habits, and not when turned on more than an hour late.
6. Turn off "Mostrar nomes nas notificações": the digest says "Você tem compromissos hoje" (no names), also on the lock screen and on the web.
7. Change the time zone in Ajustes (e.g. to Asia/Tokyo): the digest and the reminder follow the new zone's 09:00 and reminder time.
8. Edit the repetition of an older habit: a confirmation appears; past completed days keep counting in the heatmap.
9. A single date in the past moves to "Passados" (collapsed) and is not archived.

## Manual checks on the device (2.1.0: new habit from today)

Pending, on the 2.1.0 production build (the fingerprint changed once, see the root `CLAUDE.md`):

1. Today shows "Novo hábito" fixed at the bottom; the list scrolls above it and the last habit and its checkbox stay tappable. Reachable with one thumb.
2. Tap it: the sheet slides up, the name field has the focus and the keyboard pushes the sheet up (the "Criar hábito" button stays visible). All seven days start selected.
3. Type a name and press Enter on the keyboard: the habit is created and appears unchecked in today's list; the sheet closes.
4. Create a habit without today's weekday: the sheet closes, a toast says "Hábito criado. Aparece em: …", and today's list does not change. It appears on its weekdays from today on, never on past days.
5. Empty name, only spaces, or no day: inline errors, nothing created. Close with "Fechar", by tapping outside and with Android back.
6. Double tap "Criar hábito" quickly: only one habit appears (also on the web after syncing).
7. TalkBack: focus stays inside the sheet while it is open, and returns to "Novo hábito" when it closes.
8. Open a past day from the heatmap: no "Novo hábito".
9. Airplane mode: create a habit, see it in the list and mark it; the indicator shows pending changes. Turn the network back on: it syncs, and the web shows the habit and the completion.
10. No habits at all (new account): today's empty state says "Nenhum hábito ainda" and points at the footer button.

## Decisions

Moved from the root `CLAUDE.md` (owner decisions; they override anything that seems to contradict them).

- **Mobile client** (Phase 5): Android first, development build (EAS Build `development` profile in `apps/mobile/eas.json`, APK, internal distribution; local `expo run:android` as alternative), Android package `com.rxniery.habits`. Auth: Better Auth client (`better-auth/client`) with `expoClient({ scheme: "habits", storagePrefix: "habits", storage: SecureStore })`; the session cookie lives only in expo-secure-store and the API client sends it as a `Cookie` header (`credentials: "omit"`), the pattern the plugin documents, so the server needed no change (bearer stays available). Startup: splash until the stored session is checked (`get-session`; unreachable server with a stored cookie keeps the user signed in and screens show offline/error states) and the first screen's data settles (10 s cap). Any 401 signs out (the plugin clears SecureStore before calling sign-out) and `Stack.Protected` shows the login; no signup or owner-creation screen (no "owner exists" endpoint). Data layer: `src/data/repository.ts` is a domain interface (no HTTP types; errors are `DataError` kinds) implemented by `remote-repository.ts`; screens use only the TanStack Query hooks in `src/data/hooks.ts`, so Phase 7 swaps the implementation for SQLite + outbox. TanStack Query `focusManager` follows `AppState` and `onlineManager` follows `expo-network` (queries pause offline). "Today": `todayIn(settings.timezone, now())`, re-evaluated on `AppState` active and every 30 s; device zone from `expo-localization`, mismatch shows a banner ("Atualizar"/"Manter", kept per zone pair for the app run). Routes: tabs (heatmap, habits, settings), `day/[date]` with `hoje` following the day turning, habit form modals. Only today was editable until 2.3.0 (see the root `CLAUDE.md`, "Past-day editing"); toggles are optimistic with rollback, `expo-haptics` selection feedback and a small own toast. Heatmap: horizontal `FlatList` of week columns (Sunday on top) with fixed `getItemLayout` and `initialScrollIndex` putting the current week near the right edge; until 2.4.0 each day was a 44 dp `Pressable` (since 2.5.0: 28 dp days, one target and accessibility element per week; see "Visual redesign, stage 3" in the root `CLAUDE.md`). No react-native-svg or FlashList: 53 columns virtualize fine. Keyboard: `react-native-keyboard-controller` (Android edge-to-edge). Icons: `@expo/vector-icons` (MaterialCommunityIcons). App icon from the legacy `legacy/mobile/assets/icon.png` (now only in history, tag `v2.0.0`); the adaptive icon, monochrome and splash use its wordmark resized into the safe zone on violet-900 / the dark background (the legacy splash was white with English text). Versions: Expo SDK 57 (SDK 58 still beta), Better Auth 1.7.7, TanStack Query 5.104, expo-secure-store/haptics/network/localization/dev-client 57.x, react-native-keyboard-controller 1.21, @expo/vector-icons 15.1, dayjs 1.11. To verify on the first device run: Hermes `Intl.DateTimeFormat` with `timeZone` and `formatToParts` (used by `localDateAt` in core); if missing, add a fallback in `packages/core`.
