// Canonical design tokens (hex), the single source for the web (Tailwind v4
// theme, theme-css.ts) and the mobile (Tailwind v3 preset for NativeWind).
// Keys named DEFAULT map to the bare name (e.g. `bg-night-accent`).

// Visual identity since 2.4.0 ("night": dark only, calm, violet), on the web
// since 2.4.0 and on the mobile since 2.5.0 (DESIGN.md). Values are
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

/**
 * @deprecated Older token names, kept only for the mobile screens not
 * migrated yet (visual redesign stage 4). Since 2.5.0 every name points at a
 * `night` value, so those screens already show the new palette; new code
 * uses the `night-*` names. Removed in stage 4, when `night-*` becomes the
 * plain names. (The legacy values and the old heatmap levels are in git
 * history, tag v2.4.0 or earlier.)
 */
export const colors = {
	background: nightColors.bg,
	surface: nightColors.surface.DEFAULT,
	border: nightColors.border.DEFAULT,
	track: nightColors.border.strong,
	foreground: nightColors.foreground,
	muted: nightColors.muted,
	accent: {
		DEFAULT: nightColors.accent.DEFAULT,
		hover: nightColors.accent.hover,
	},
	violet: {
		300: nightColors.accent.text,
		400: nightColors.accent.text,
		500: nightColors.accent.hover,
		600: nightColors.accent.DEFAULT,
		700: nightColors.accent.hover,
		800: nightColors.heat[2],
		900: nightColors.heat[1],
	},
	success: {
		DEFAULT: nightColors.success.DEFAULT,
		hover: nightColors.success.DEFAULT,
	},
	danger: {
		DEFAULT: nightColors.danger.DEFAULT,
		surface: nightColors.danger.surface,
	},
	warning: {
		DEFAULT: nightColors.warning.DEFAULT,
		surface: nightColors.warning.surface,
	},
} as const;

export const nightFonts = {
	// Web: self-hosted (fontsource), Latin subset only; see
	// apps/web/src/styles.css. The mobile loads static TTFs under its own
	// family names (apps/mobile/src/ui/fonts.ts), so it does not use this
	// stack (`font-display`) directly.
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
