import { describe, expect, it } from "vitest";
import {
	FALLBACK_NOTIFICATION,
	notificationFor,
	safeAppPath,
} from "./push-payload.ts";

describe("notificationFor", () => {
	it("shows a valid reminder as sent", () => {
		expect(
			notificationFor({
				v: 1,
				kind: "reminder",
				title: "Habits",
				body: "Você tem 2 hábitos pendentes hoje.",
				url: "/today",
				tag: "reminder-2026-10-10",
			})
		).toEqual({
			title: "Habits",
			body: "Você tem 2 hábitos pendentes hoje.",
			url: "/today",
			tag: "reminder-2026-10-10",
		});
	});

	it("falls back for unreadable or unknown payloads", () => {
		expect(notificationFor(null)).toBe(FALLBACK_NOTIFICATION);
		expect(notificationFor({ v: 2, title: "x" })).toBe(FALLBACK_NOTIFICATION);
		expect(
			notificationFor({
				v: 1,
				kind: "reminder",
				title: "Habits",
				body: "x",
				url: "https://evil.example",
				tag: "t",
			})
		).toBe(FALLBACK_NOTIFICATION);
	});
});

describe("safeAppPath", () => {
	it("keeps app paths and replaces anything else with /today", () => {
		expect(safeAppPath("/day/2026-10-10")).toBe("/day/2026-10-10");
		expect(safeAppPath("//evil.example")).toBe("/today");
		expect(safeAppPath("/\\evil.example")).toBe("/today");
		expect(safeAppPath("https://evil.example")).toBe("/today");
		expect(safeAppPath(undefined)).toBe("/today");
	});
});
