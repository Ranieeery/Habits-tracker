import { useEffect, useRef } from "react";

export interface DayShortcuts {
	/** Esc: leave the day (back to the heatmap). */
	onEscape: () => void;
	/** ←: the previous day, when there is one. */
	onPrevious?: () => void;
	/** →: the next day, when there is one. */
	onNext?: () => void;
}

/** A dialog, alert dialog or popover (calendar) is open: Esc belongs to it. */
function hasOpenLayer(): boolean {
	return (
		document.querySelector(
			'[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-popper-content-wrapper]'
		) !== null
	);
}

/** Typing in a field: keys edit text, they do not navigate. */
function isEditable(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		target.closest("input, textarea, select, [contenteditable]") !== null
	);
}

/**
 * Keyboard shortcuts of the day screen opened from the heatmap. Listens on
 * `window` in the capture phase, so it runs before Radix's own Esc handling
 * and can see a dialog that is still open: then the key is left alone (Esc
 * closes only the dialog). Ignored while typing, with modifiers and during
 * IME composition.
 */
export function useDayShortcuts(shortcuts: DayShortcuts) {
	// Always the latest callbacks without re-subscribing on every render.
	const latest = useRef(shortcuts);
	useEffect(() => {
		latest.current = shortcuts;
	});

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.isComposing) return;
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
				return;
			if (hasOpenLayer() || isEditable(event.target)) return;
			const { onEscape, onPrevious, onNext } = latest.current;
			const action =
				event.key === "Escape"
					? onEscape
					: event.key === "ArrowLeft"
						? onPrevious
						: event.key === "ArrowRight"
							? onNext
							: undefined;
			if (!action) return;
			event.preventDefault();
			action();
		};
		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			window.removeEventListener("keydown", onKeyDown, { capture: true });
	}, []);
}
