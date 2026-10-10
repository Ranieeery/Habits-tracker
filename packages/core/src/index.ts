// Pure domain logic: dates, schedules, completion ratios, streaks and the
// heatmap grid (Phase 1). No I/O and no framework imports.

/** How many days back a client may write completions (allows offline sync). */
export const BACKFILL_DAYS = 7;
