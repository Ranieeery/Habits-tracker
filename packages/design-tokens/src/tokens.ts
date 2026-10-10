// Canonical design tokens (hex). Values come from the legacy apps: the mobile
// styles and logo use Tailwind v3 hex values; the legacy web used Tailwind v4
// OKLCH classes, converted here to the same hex so web and mobile match.
// Keys named DEFAULT map to the bare name (e.g. `bg-accent`).

export const colors = {
	background: "#09090a",
	surface: "#18181b", // zinc-900: heatmap cells, popovers, dialogs
	border: "#27272a", // zinc-800: borders, inputs
	track: "#3f3f46", // zinc-700: progress bar track
	foreground: "#ffffff",
	muted: "#a1a1aa", // zinc-400: secondary text
	accent: {
		DEFAULT: "#8e51ff", // "Novo hábito" button border/icon (both legacy apps)
		hover: "#c4b5fd",
	},
	violet: {
		300: "#c4b5fd",
		400: "#a78bfa",
		500: "#8b5cf6",
		600: "#7c3aed", // progress bar fill, loading, focus ring
		700: "#6d28d9",
		800: "#5b21b6",
		900: "#4c1d95",
	},
	success: {
		DEFAULT: "#16a34a", // checked checkbox, confirm button
		hover: "#22c55e",
	},
	// Heatmap levels 0 (nothing done) to 5 (>= 80%), legacy mobile mapping.
	heatmap: {
		0: "#18181b",
		"0-border": "#27272a",
		1: "#a78bfa",
		"1-border": "#8b5cf6",
		2: "#7c3aed",
		"2-border": "#8b5cf6",
		3: "#6d28d9",
		"3-border": "#7c3aed",
		4: "#5b21b6",
		"4-border": "#6d28d9",
		5: "#4c1d95",
		"5-border": "#5b21b6",
	},
} as const;

/** Number of heatmap intensity levels, including level 0. */
export const HEATMAP_LEVELS = 6;

export const radius = {
	sm: "6px",
	md: "8px", // heatmap cells, checkboxes, buttons
	lg: "12px", // progress bar
	xl: "16px", // dialogs, popovers
} as const;

export const fontFamily = {
	sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
} as const;

/** Minimum touch target on mobile, in density-independent pixels. */
export const TOUCH_TARGET_MIN = 44;

// Only named sizes; the Tailwind default scale covers the rest of the layout.
export const spacing = {
	touch: `${TOUCH_TARGET_MIN}px`, // e.g. min-h-touch, min-w-touch
} as const;
