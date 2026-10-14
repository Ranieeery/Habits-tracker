import { describe, expect, it } from "vitest";
import { completionRatio, heatmapLevel, summarizeDay } from "./progress.ts";
import { NO_RESCHEDULES } from "./reschedule-index.ts";

describe("completionRatio", () => {
	it("is 0 when nothing is possible and clamps to 1", () => {
		expect(completionRatio(0, 0)).toBe(0);
		expect(completionRatio(2, 0)).toBe(0);
		expect(completionRatio(1, 4)).toBe(0.25);
		expect(completionRatio(5, 4)).toBe(1);
	});
});

describe("heatmapLevel", () => {
	it.each([
		[0, 0],
		[0.01, 1],
		[0.199, 1],
		[0.2, 2],
		[0.399, 2],
		[0.4, 3],
		[0.6, 4],
		[0.799, 4],
		[0.8, 5],
		[1, 5],
	])("maps ratio %s to level %s", (ratio, level) => {
		expect(heatmapLevel(ratio)).toBe(level);
	});

	it("maps exact fractions without floating point drift", () => {
		expect(heatmapLevel(completionRatio(1, 5))).toBe(2);
		expect(heatmapLevel(completionRatio(3, 5))).toBe(4);
		expect(heatmapLevel(completionRatio(4, 5))).toBe(5);
		expect(heatmapLevel(completionRatio(2, 3))).toBe(4);
	});
});

describe("summarizeDay", () => {
	const sp = { reschedules: NO_RESCHEDULES, timeZone: "America/Sao_Paulo" };
	const base = {
		start_date: "2026-01-01",
		archived_at: null,
		deleted_at: null,
	};
	const daily = {
		...base,
		id: "a",
		schedule: { type: "weekdays" as const, days: [0, 1, 2, 3, 4, 5, 6] },
	};
	const mondays = {
		...base,
		id: "b",
		schedule: { type: "weekdays" as const, days: [1] },
	};

	it("counts only live completions of that day", () => {
		// 2026-01-06 is a Tuesday: only the daily habit is possible.
		const completions = [
			{ habit_id: "a", date: "2026-01-06", deleted_at: null },
			{ habit_id: "a", date: "2026-01-05", deleted_at: null },
		];
		expect(
			summarizeDay([daily, mondays], completions, "2026-01-06", sp)
		).toEqual({ possible: 1, completed: 1 });
		expect(
			summarizeDay(
				[daily, mondays],
				[{ habit_id: "a", date: "2026-01-06", deleted_at: 9 }],
				"2026-01-06",
				sp
			)
		).toEqual({ possible: 1, completed: 0 });
	});

	it("counts a completion on a day the schedule no longer includes", () => {
		// The Monday habit was completed on a Tuesday (schedule edited later):
		// it counts as possible and done, so the ratio stays at most 100%.
		const completions = [
			{ habit_id: "a", date: "2026-01-06", deleted_at: null },
			{ habit_id: "b", date: "2026-01-06", deleted_at: null },
		];
		expect(
			summarizeDay([daily, mondays], completions, "2026-01-06", sp)
		).toEqual({ possible: 2, completed: 2 });
	});

	it("ignores completions of deleted habits", () => {
		expect(
			summarizeDay(
				[{ ...mondays, deleted_at: 5 }],
				[{ habit_id: "b", date: "2026-01-06", deleted_at: null }],
				"2026-01-06",
				sp
			)
		).toEqual({ possible: 0, completed: 0 });
	});
});
