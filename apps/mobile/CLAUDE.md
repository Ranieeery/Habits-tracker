# apps/mobile

Expo (SDK 57) + Expo Router, the primary client. See the root `CLAUDE.md` for architecture and design rules, and `AGENTS.md` (Expo template) for Expo-specific guidance: always check the versioned Expo docs before using an Expo/RN API.

- Routes live in `src/app/` (`_layout.tsx`, `index.tsx`); typed routes and the React Compiler are enabled in `app.json`.
- Add native/Expo packages with `pnpm exec expo install <pkg>` so versions match the SDK.
- Styling: NativeWind 4 (Tailwind v3). `tailwind.config.js` uses the preset from `@habits/design-tokens/tailwind-v3-preset`; `src/global.css` is wired in `metro.config.js` and `babel.config.js`. `react-native-css-interop` is a direct dependency and must match the version `nativewind` pins.
- API base URL comes from `EXPO_PUBLIC_API_URL` (see `.env.example`). Never hardcode it.
- Version is `2.0.0` in both `package.json` and `expo.version` in `app.json`; keep them in sync.
- Use a development build, not Expo Go, for push notifications (Phase 6).
- `*.config.js` files are CommonJS (ESLint override in `eslint.config.mjs`).
