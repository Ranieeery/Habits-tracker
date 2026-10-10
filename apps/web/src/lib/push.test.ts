import { describe, expect, it } from "vitest";
import {
	deviceLabel,
	type PushEnvironment,
	pushSupport,
	vapidKeyBytes,
} from "./push.ts";

const ready: PushEnvironment = {
	hasPushApi: true,
	hasVapidKey: true,
	isIos: false,
	isStandalone: false,
	permission: "default",
};

describe("pushSupport", () => {
	it("follows the notification permission", () => {
		expect(pushSupport(ready)).toBe("prompt");
		expect(pushSupport({ ...ready, permission: "granted" })).toBe("granted");
		expect(pushSupport({ ...ready, permission: "denied" })).toBe("denied");
	});

	it("is unsupported without the Push API or a VAPID key", () => {
		expect(pushSupport({ ...ready, hasPushApi: false })).toBe("unsupported");
		expect(pushSupport({ ...ready, hasVapidKey: false })).toBe("unsupported");
		expect(pushSupport({ ...ready, permission: null })).toBe("unsupported");
	});

	it("asks iOS users to install the app first", () => {
		expect(
			pushSupport({
				...ready,
				isIos: true,
				hasPushApi: false,
				permission: null,
			})
		).toBe("ios-needs-install");
		expect(pushSupport({ ...ready, isIos: true, isStandalone: true })).toBe(
			"prompt"
		);
	});
});

describe("deviceLabel", () => {
	it("names common browsers and systems", () => {
		expect(
			deviceLabel(
				"Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36"
			)
		).toBe("Chrome no Android");
		expect(
			deviceLabel(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0"
			)
		).toBe("Edge no Windows");
		expect(
			deviceLabel(
				"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
			)
		).toBe("Safari no iPhone");
		expect(deviceLabel("curl/8")).toBeNull();
	});
});

describe("vapidKeyBytes", () => {
	it("decodes base64url", () => {
		expect(Array.from(vapidKeyBytes("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
	});
});
