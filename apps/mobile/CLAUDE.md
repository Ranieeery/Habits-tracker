# apps/mobile

Expo (SDK 57) + Expo Router, the primary client (target: Android). See the root `CLAUDE.md` for architecture and design rules, and `AGENTS.md` (Expo template) for Expo-specific guidance: always check the versioned Expo docs before using an Expo/RN API.

## Running it

A development build is required (not Expo Go): secure storage, haptics and, later, push need native modules.

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

- `src/app/`: routes only (thin files re-exporting screens). `_layout.tsx` creates the services and the QueryClient, keeps the splash up while the session is restored, and switches between `login` and `(app)` with `Stack.Protected`. `(app)/_layout.tsx` loads the user's settings (`SettingsGate`) before any authenticated screen. Tabs: `(app)/(tabs)/index` (heatmap), `habits`, `settings`. Stack screens: `day/[date]` (`YYYY-MM-DD` or `hoje`, which follows the day turning), `habit/new`, `habit/[id]` (modals).
- `src/data/`: the only layer that knows where data comes from. `repository.ts` (domain interface), `remote-repository.ts` (HTTP via `@habits/api-client`, the only import of it), `errors.ts` (`DataError` kinds and pt-BR messages), `auth.ts` (Better Auth + `expoClient`), `hooks.ts` (TanStack Query hooks the screens use), `today.ts` (`useToday`, settings context), `services.ts` (the only `Date.now()` and device time zone), `query-client.ts`, push: `push.ts` (channel `reminders`, permission, Expo token via `extra.eas.projectId`, device id in SecureStore), `push-logic.ts` (pure), `push-registration.ts` (register/unregister this device), `push-hooks.ts` (reminders, test push, token sync), and `NotificationsRepository` in `repository.ts` (stays remote in Phase 7). Phase 7 replaces `remote-repository.ts` with a local SQLite repository + outbox behind the same interface.
- `src/features/notifications/notification-responder.tsx` (in the authenticated layout): registers the token, handles taps (also from a cold start) by opening `/day/hoje`, and shows foreground notifications as a toast (the handler hides the banner and sound).
- `src/features/<screen>/`: screens and their components. `src/ui/`: shared primitives (Button, TextField, states, Toast, Screen, splash). `src/lib/`: pure helpers (dayjs pt-BR formatting, time zone banner rule).

## Rules

- Screens never import `@habits/api-client` or call `fetch`; they use the hooks in `src/data/hooks.ts`. Date, schedule, ratio, level and grid logic comes from `@habits/core` only.
- The session cookie lives only in expo-secure-store, managed by the Better Auth Expo plugin (`storagePrefix: "habits"`); API calls send it as a `Cookie` header with `credentials: "omit"`. Never use AsyncStorage for it and never log headers, cookies or session data.
- Any `unauthorized` error from a query or mutation signs out (clears SecureStore) and the guard shows the login. Network failures never sign out.
- Colors only from `@habits/design-tokens`: Tailwind classes from the preset, or `colors.*` for style props NativeWind does not cover (navigation options, icons, heatmap cells). No hex literals in `src/`.
- NativeWind `className` works on React Native core components; for third-party ones (SafeAreaView, KeyboardAwareScrollView, Reanimated views) use `style` or wrap a core `View`.
- Touch targets >= 44 dp (`min-h-touch`, `size-touch`); forms live inside `Screen` (keyboard-aware scroll, needed because Android is edge-to-edge).
- Tests: Vitest for pure modules only (`src/**/*.test.ts`, node environment, no React Native imports); no component tests. `pnpm --filter mobile test`.
- Add native/Expo packages with `pnpm exec expo install <pkg>` so versions match the SDK; check with `pnpm dlx expo-doctor`.
- Styling: NativeWind 4 (Tailwind v3). `tailwind.config.js` uses the preset from `@habits/design-tokens/tailwind-v3-preset`; `src/global.css` is wired in `metro.config.js` and `babel.config.js`. `react-native-css-interop` is a direct dependency and must match the version `nativewind` pins.
- Version is `2.0.0` in both `package.json` and `expo.version` in `app.json`; keep them in sync.
- `*.config.js` files are CommonJS (ESLint override in `eslint.config.mjs`); the Vitest config is `vitest.config.mts` because the package is CommonJS.
