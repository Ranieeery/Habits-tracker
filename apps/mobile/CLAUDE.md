# apps/mobile

Expo (SDK 57) + Expo Router, the primary client (target: Android). See the root `CLAUDE.md` for architecture and design rules, and `AGENTS.md` (Expo template) for Expo-specific guidance: always check the versioned Expo docs before using an Expo/RN API.

## Running it

A development build is required (not Expo Go): secure storage, haptics, push, SQLite and background tasks need native modules. **Phase 7 added native modules** (expo-sqlite, expo-background-task, expo-task-manager, expo-crypto): builds made before it do not have them, so build again.

1. `cp apps/mobile/.env.example apps/mobile/.env` and pick the API (see below). `EXPO_PUBLIC_API_URL` is inlined by Metro, so changing it needs a Metro restart, not a new build.
2. Build and install the development APK once (again only after adding a native dependency or changing a config plugin in `app.json`):
   - **EAS Build (recommended, no Android SDK needed):** `cd apps/mobile`, `pnpm dlx eas-cli@latest login`, then `pnpm dlx eas-cli@latest build --profile development --platform android`. The first run links an Expo project (writes `extra.eas.projectId` to `app.json`). Install the APK from the QR code/link.
   - **Local:** `pnpm --filter mobile exec expo run:android`. Needs JDK 17 (`JAVA_HOME`), Android Studio with SDK Platform 36, `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`, `platform-tools` on `Path`, and Windows long paths enabled. `android/` is generated (CNG) and gitignored: never edit it.
3. `pnpm --filter mobile start` and open the app on the phone.

### Push notifications (Android)

Push tokens need Firebase, and both steps below change the native app (new development build):

1. Firebase console: create a project, add an Android app with package `com.rxniery.habits`, download `google-services.json` to `apps/mobile/` (public identifiers, commit it; `app.config.js` only references it when the file exists).
2. Firebase > Project settings > Service accounts > Generate new private key; upload it with `eas credentials` (Android > Google Service Account > FCM V1). That JSON is a secret: never commit it.
3. Rebuild the development build (`eas build --profile development --platform android`).

Permission is asked only when reminders are turned on in Ajustes. Without Firebase, enabling reminders reports this device as unavailable; Web Push devices and the rest of the app keep working.

### Pointing at an API

- **Local, USB (recommended):** `pnpm --filter api dev`, phone on USB with debugging on, `adb reverse tcp:8787 tcp:8787` and `adb reverse tcp:8081 tcp:8081` (Metro), `EXPO_PUBLIC_API_URL=http://localhost:8787`. Sign in as `dev@habits.local` / `habits-dev-password` after `db:seed:local`.
- **Local, Wi-Fi:** `pnpm --filter api dev -- --ip 0.0.0.0`, `EXPO_PUBLIC_API_URL=http://<PC LAN IP>:8787` (debug builds allow cleartext HTTP).
- **Production:** `EXPO_PUBLIC_API_URL=https://habits.rxniery.workers.dev/api` (the public gateway; `habits-api` has no URL of its own).

The value is the API base without `/v1` and without a trailing slash. The API already trusts the `habits://` origin (Better Auth `expo()` plugin), so no server change is needed per environment.

## Layout

- `src/app/`: routes only (thin files re-exporting screens). `_layout.tsx` gets the services (`getServices()`), creates the QueryClient, wires the sync engine's events to it (data changed → invalidate, settings changed, 401 → sign out keeping the database), imports `data/sync/background.ts` (the task must be defined at module scope), keeps the splash up while the session is restored, and switches between `login` and `(app)` with `Stack.Protected`. `(app)/_layout.tsx`: `InitialSyncGate` (starts the sync triggers; until the first full pull of this user finishes it shows its progress, or an offline/error state, instead of the app), then `SettingsGate` (the user's settings, from the local copy). Tabs: `(app)/(tabs)/index` (heatmap), `habits`, `settings`. Stack screens: `day/[date]` (`YYYY-MM-DD` or `hoje`, which follows the day turning), `habit/new`, `habit/[id]`, `sync` (modals).
- `src/data/`: the only layer that knows where data comes from. `repository.ts` (domain interface), `remote-repository.ts` (HTTP via `@habits/api-client`: settings, push devices, and the cookie-authenticated `fetch`), `errors.ts` (`DataError` kinds and pt-BR messages), `auth.ts` (Better Auth + `expoClient`), `hooks.ts` (TanStack Query hooks the screens use, sync hooks re-exported), `today.ts` (`useToday`, settings context), `services.ts` (one instance per JS context via `getServices()`; the only `Date.now()`, device time zone and id generator; `prepareLocalData` binds the database to the signed-in user), `query-client.ts` (`networkMode: "always"`: data is local), push: `push.ts`, `push-logic.ts` (pure), `push-registration.ts`, `push-hooks.ts`, and `NotificationsRepository` in `repository.ts` (remote: push needs the server).
- `src/data/local/`: the device database. `sql.ts` (minimal `SqlDatabase` interface), `expo-sql.ts` (expo-sqlite, `withExclusiveTransactionAsync`), `migrations.ts` (versioned schema by `PRAGMA user_version`: append, never edit a shipped version), `store.ts` (all SQL: server mirror, outbox, meta, lease), `local-repository.ts` (the `HabitsRepository` the app uses: reads `materialize(mirror, outbox)` from core and builds day/year views with core's `dayView`/`summarizeYear`; writes one outbox mutation and call `notifyLocalWrite`; settings from the local copy). `testing/` is for Vitest only: `node-sql.ts` (`node:sqlite` adapter), `fake-server.ts` (in-memory server on core's rules).
- `src/data/sync/`: `engine.ts` (push → pull → settings, lock + lease, backoff with jitter, status for the UI), `transport.ts` (requests with a 20 s timeout, error classification, `Date`/`Retry-After` headers), `triggers.ts` (`useSyncTriggers`: launch, foreground, network via `expo-network`, every 5 min, background registration after the first sync), `background.ts` (`habits-sync` task, expo-background-task), `failures.ts` (pt-BR descriptions of refused changes), `hooks.ts`.
- `src/features/sync/`: `initial-sync-gate.tsx`, `sync-indicator.tsx` (heatmap header and Ajustes), `sync-screen.tsx` (status, "Sincronizar agora", clock warning, failures with "Tentar de novo"/"Descartar").
- `src/features/notifications/notification-responder.tsx` (in the authenticated layout): registers the token, handles taps (also from a cold start) by opening `/day/hoje`, and shows foreground notifications as a toast (the handler hides the banner and sound).
- `src/features/<screen>/`: screens and their components. `src/ui/`: shared primitives (Button, TextField, states, Toast, Screen, splash). `src/lib/`: pure helpers (dayjs pt-BR formatting, time zone banner rule).

## Rules

- Screens never import `@habits/api-client` or call `fetch`; they use the hooks in `src/data/hooks.ts`. Date, schedule, ratio, level and grid logic comes from `@habits/core` only.
- The session cookie lives only in expo-secure-store, managed by the Better Auth Expo plugin (`storagePrefix: "habits"`); API calls send it as a `Cookie` header with `credentials: "omit"`. Never use AsyncStorage for it and never log headers, cookies or session data.
- Any `unauthorized` error from a query, mutation or sync signs out (clears SecureStore) and the guard shows the login; the device database is kept for the same user. Network failures never sign out. "Sair" in Ajustes wipes the database after warning about unsynced changes; a different user signing in wipes it before anything shows.
- Screens never touch the database, the outbox or the sync engine directly: hooks only (`useSyncStatus`, `useSyncFailures`, ...). Habit and completion writes are local and instant; only settings and push need the network.
- Colors only from `@habits/design-tokens`: Tailwind classes from the preset, or `colors.*` for style props NativeWind does not cover (navigation options, icons, heatmap cells). No hex literals in `src/`.
- NativeWind `className` works on React Native core components; for third-party ones (SafeAreaView, KeyboardAwareScrollView, Reanimated views) use `style` or wrap a core `View`.
- Touch targets >= 44 dp (`min-h-touch`, `size-touch`); forms live inside `Screen` (keyboard-aware scroll, needed because Android is edge-to-edge).
- Tests: Vitest for modules without React Native imports (`src/**/*.test.ts`, node environment); no component tests. The local store and the sync engine run their real SQL on Node's `node:sqlite` in memory (`data/local/testing/`), against a fake server built on core's sync rules. `pnpm --filter mobile test`.

- Add native/Expo packages with `pnpm exec expo install <pkg>` so versions match the SDK; check with `pnpm dlx expo-doctor`.
- Styling: NativeWind 4 (Tailwind v3). `tailwind.config.js` uses the preset from `@habits/design-tokens/tailwind-v3-preset`; `src/global.css` is wired in `metro.config.js` and `babel.config.js`. `react-native-css-interop` is a direct dependency and must match the version `nativewind` pins.
- Version is `2.0.0` in both `package.json` and `expo.version` in `app.json`; keep them in sync.
- `*.config.js` files are CommonJS (ESLint override in `eslint.config.mjs`); the Vitest config is `vitest.config.mts` because the package is CommonJS.

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
9. Failures: create a habit offline, keep the phone offline for more than 7 days (or move the clock): the creation and its completions appear grouped in "Falhas"; "Descartar" removes them all.
