/**
 * A short "done" pulse (transform only) on `element`. Callers skip it when
 * the user prefers reduced motion; it is a no-op where the Web Animations
 * API is missing (tests).
 */
export function pulse(element: Element | null | undefined) {
	if (!element || typeof element.animate !== "function") return;
	element.animate(
		[
			{ transform: "scale(1)" },
			{ transform: "scale(1.15)" },
			{ transform: "scale(1)" },
		],
		{ duration: 320, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" }
	);
}
