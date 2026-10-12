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
	// Not in the legacy apps (they had no error UI). red-400 reads well on the
	// dark background; red-950 is the background of error alerts.
	danger: {
		DEFAULT: "#f87171",
		surface: "#450a0a",
	},
	// Alerts that are not errors (2.3.0: "Editando dia passado"). amber-400 on
	// amber-950 (about 9:1) and on the dark background; always paired with
	// text and an icon, never color alone.
	warning: {
		DEFAULT: "#fbbf24",
		surface: "#451a03",
	},
	// Heatmap levels 0 (nothing done) to 5 (>= 80%). Like GitHub's dark theme,
	// more done is brighter: violet-900 up to violet-400 on the dark surface.
	heatmap: {
		0: "#18181b",
		"0-border": "#27272a",
		1: "#4c1d95",
		"1-border": "#5b21b6",
		2: "#5b21b6",
		"2-border": "#6d28d9",
		3: "#6d28d9",
		"3-border": "#7c3aed",
		4: "#7c3aed",
		"4-border": "#8b5cf6",
		5: "#a78bfa",
		"5-border": "#c4b5fd",
	},
} as const;

// Visual identity of the 2.4.0 redesign ("night": dark only, calm, violet).
// Web only until the mobile stage: the Tailwind v3 preset (NativeWind) does
// not include it, so the mobile keeps `colors` above unchanged. Values are
// OKLCH (hue 293) converted to hex; the heatmap levels climb in equal steps
// of OKLCH lightness (0.22 to 0.78), so each level looks one step brighter
// (1.4 to 1.6:1 between neighbors). WCAG contrasts are noted per value.
export const nightColors = {
	bg: "#0a0911", // near-black with a violet tint
	surface: {
		DEFAULT: "#13111c", // panels
		raised: "#1c1928", // hover, raised cards
		overlay: "#262234", // tooltip, popovers
	},
	border: {
		DEFAULT: "#2c2939", // subtle dividers
		strong: "#403c53", // empty heatmap cells, fields
	},
	foreground: "#f2f0f9", // 17.6:1 on bg
	muted: "#b1aec3", // 9.2:1 on bg
	subtle: "#8c89a0", // 5.9:1 on bg: month/weekday labels, legend
	accent: {
		DEFAULT: "#8456e8", // primary button, switch on (UI, 4.2:1 on bg)
		hover: "#946cf8",
		text: "#bba7ff", // links, focus ring, active nav (9.5:1 on bg)
		on: "#ffffff", // text on `accent` (4.7:1; foreground would be 4.2)
	},
	glow: "#7c49e3", // page glow and level 4-5 cells, always with alpha
	heat: {
		0: "#1b1827", // nothing done (outlined with border-strong)
		1: "#392863",
		2: "#583b9c",
		3: "#7952d4",
		4: "#9978f5",
		5: "#bba7ff",
	},
	success: {
		DEFAULT: "#4fce74", // 9.8:1 on bg
		surface: "#0d2814",
	},
	danger: {
		DEFAULT: "#fd7273", // 7.4:1 on bg, 6.3:1 on its surface
		surface: "#371112",
	},
	warning: {
		DEFAULT: "#fabb41",
		surface: "#311d03",
	},
} as const;

export const nightFonts = {
	// Self-hosted (fontsource), Latin subset only; see apps/web/src/styles.css.
	display: [
		"Bricolage Grotesque Variable",
		"ui-sans-serif",
		"system-ui",
		"sans-serif",
	],
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
