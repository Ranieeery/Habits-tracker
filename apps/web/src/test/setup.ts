import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, vi } from "vitest";

// Browser APIs jsdom does not implement, used by the router (scroll
// restoration), Radix (element size) and sonner (media queries, and pointer
// capture when a toast's action is clicked).
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollTo = vi.fn() as unknown as Element["scrollTo"];
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??=
	ResizeObserverStub as unknown as typeof ResizeObserver;

window.matchMedia ??= (query: string) =>
	({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	}) as MediaQueryList;

afterEach(() => {
	// sonner keeps toasts in a module-level store shared by every test.
	toast.dismiss();
	cleanup();
	localStorage.clear();
	vi.restoreAllMocks();
});
