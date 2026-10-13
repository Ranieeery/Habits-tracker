// Where the toast sits (2.6.0, DESIGN.md "Mobile"): never over a fixed
// action. Pure, so the rule is tested without React Native.

/** Room between the toast and what it sits above. */
export const TOAST_GAP = 8;
/** Clears the tab bar (about 64 dp) when the screen has no fixed footer. */
export const TAB_BAR_OFFSET = 80;

/**
 * Distance from the bottom of the window to the toast's bottom edge. With a
 * fixed footer on the focused screen (its top measured in window
 * coordinates), the toast sits just above it; otherwise above the tab bar.
 */
export function toastBottomOffset({
	windowHeight,
	safeBottom,
	footerTop,
}: {
	windowHeight: number;
	safeBottom: number;
	footerTop: number | null;
}): number {
	const aboveTabBar = safeBottom + TAB_BAR_OFFSET;
	if (footerTop === null || footerTop <= 0 || footerTop > windowHeight) {
		return aboveTabBar;
	}
	return Math.max(windowHeight - footerTop + TOAST_GAP, safeBottom + TOAST_GAP);
}
