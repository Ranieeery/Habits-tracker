// 2.9.0: the app icons are drawn from @habits/design-tokens' MARK_SQUARES;
// the mark on screen must stay the same drawing.
import {
	MARK_SQUARE_RADIUS,
	MARK_SQUARE_SIZE,
	MARK_SQUARES,
} from "@habits/design-tokens";
import { expect, it } from "vitest";
import source from "./wordmark.tsx?raw";

/** Same order whatever the drawing order in the file. */
const byPosition = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	a.y - b.y || a.x - b.x;

it("draws the same squares as the app icon", () => {
	const rects = [...source.matchAll(/<rect([\s\S]*?)\/>/g)].map(([, attrs]) => {
		const value = (name: string) =>
			attrs?.match(new RegExp(`${name}="([^"]+)"`))?.[1];
		return {
			x: Number(value("x")),
			y: Number(value("y")),
			size: Number(value("width")),
			radius: Number(value("rx")),
			level: Number(value("className")?.match(/night-heat-(\d)/)?.[1]),
		};
	});
	expect(rects.sort(byPosition)).toEqual(
		MARK_SQUARES.map(({ x, y, level }) => ({
			x,
			y,
			size: MARK_SQUARE_SIZE,
			radius: MARK_SQUARE_RADIUS,
			level,
		})).sort(byPosition)
	);
});
