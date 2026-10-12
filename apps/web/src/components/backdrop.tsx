/**
 * The fixed page backdrop of the 2.4.0 identity: the night background and one
 * soft violet glow at the top (no image, nothing animated). Shared by the app
 * layout and the login screen.
 */
export function Backdrop() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0 -z-10 bg-night-bg bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,color-mix(in_oklab,var(--color-night-glow)_24%,transparent),transparent_70%)]"
		/>
	);
}
