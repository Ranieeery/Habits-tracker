// Alpha over a token (DESIGN.md: alpha only on top of a token, never a new
// color). Style props NativeWind does not cover (boxShadow, gradients) need
// it as an rgba() string.

/** `withAlpha("#7c49e3", 0.3)` → `"rgba(124, 73, 227, 0.3)"` */
export function withAlpha(hex: string, alpha: number): string {
	const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!match) throw new Error(`Not a 6-digit hex color: ${hex}`);
	const [r, g, b] = match.slice(1).map((part) => Number.parseInt(part, 16));
	const a = Math.min(1, Math.max(0, alpha));
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}
