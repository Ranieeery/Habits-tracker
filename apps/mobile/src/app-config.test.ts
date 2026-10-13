// 2.9.0: app.json cannot import the tokens, so its native colors (window
// background, splash, adaptive icon, notification accent) are checked here.
import { nightColors } from "@habits/design-tokens";
import { describe, expect, it } from "vitest";

const [raw] = Object.values(
	import.meta.glob<string>("../app.json", {
		query: "?raw",
		import: "default",
		eager: true,
	})
);

interface AppJson {
	expo: {
		backgroundColor: string;
		android: { adaptiveIcon: { backgroundColor: string } };
		plugins: (string | [string, Record<string, unknown>])[];
	};
}

const { expo } = JSON.parse(raw ?? "{}") as AppJson;
const plugin = (name: string) =>
	expo.plugins.find(
		(entry): entry is [string, Record<string, unknown>] =>
			Array.isArray(entry) && entry[0] === name
	)?.[1];

describe("native colors in app.json", () => {
	it("use the night background for the window, the splash and the icon", () => {
		expect(expo.backgroundColor).toBe(nightColors.bg);
		expect(plugin("expo-splash-screen")?.backgroundColor).toBe(nightColors.bg);
		expect(expo.android.adaptiveIcon.backgroundColor).toBe(nightColors.bg);
	});

	it("tints notifications with the accent", () => {
		expect(plugin("expo-notifications")?.color).toBe(
			nightColors.accent.DEFAULT
		);
	});
});
