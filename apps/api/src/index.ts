import { createApp } from "./app.ts";

// The only place that reads the real clock (see `lib/clock.ts`).
export default createApp({ now: () => Date.now() });
