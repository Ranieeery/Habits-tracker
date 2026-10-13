import { describe, expect, it } from "vitest";
import {
	TAB_BAR_OFFSET,
	TOAST_GAP,
	toastBottomOffset,
} from "./toast-position.ts";

describe("toastBottomOffset", () => {
	const base = { windowHeight: 820, safeBottom: 24 };

	it("sits above the tab bar when the screen has no fixed footer", () => {
		expect(toastBottomOffset({ ...base, footerTop: null })).toBe(
			24 + TAB_BAR_OFFSET
		);
	});

	it("sits just above a fixed footer (e.g. Novo hábito)", () => {
		// Footer starting 150 dp from the bottom (tab bar + button).
		expect(toastBottomOffset({ ...base, footerTop: 670 })).toBe(
			150 + TOAST_GAP
		);
	});

	it("never goes below the safe area", () => {
		expect(toastBottomOffset({ ...base, footerTop: 815 })).toBe(24 + TOAST_GAP);
	});

	it("ignores a measure outside the window", () => {
		expect(toastBottomOffset({ ...base, footerTop: 0 })).toBe(
			24 + TAB_BAR_OFFSET
		);
		expect(toastBottomOffset({ ...base, footerTop: 900 })).toBe(
			24 + TAB_BAR_OFFSET
		);
	});
});
