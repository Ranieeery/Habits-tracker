/**
 * Current instant in UTC ms. Injected into the app so tests control "now";
 * `src/index.ts` is the only place that reads the real clock. A user's
 * calendar day is always `todayIn(timezone, now())`, never the server's.
 */
export type Clock = () => number;
