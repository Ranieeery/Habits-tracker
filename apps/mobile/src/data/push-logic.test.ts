import { describe, expect, it } from "vitest";
import { notificationPath, permissionFrom } from "./push-logic.ts";

describe("permissionFrom", () => {
	it("maps the expo-notifications permission response", () => {
		expect(
			permissionFrom({ granted: true, canAskAgain: true, status: "granted" })
		).toBe("granted");
		expect(
			permissionFrom({
				granted: false,
				canAskAgain: true,
				status: "undetermined",
			})
		).toBe("undetermined");
		// Refused once on Android 13+: the app may still ask again.
		expect(
			permissionFrom({ granted: false, canAskAgain: true, status: "denied" })
		).toBe("undetermined");
		expect(
			permissionFrom({ granted: false, canAskAgain: false, status: "denied" })
		).toBe("denied");
	});
});

describe("notificationPath", () => {
	it("opens the path a notification carries, or today", () => {
		expect(notificationPath({ url: "/habits" })).toBe("/habits");
		expect(notificationPath({ url: "//evil.example" })).toBe("/");
		expect(notificationPath({ url: "https://evil.example" })).toBe("/");
		expect(notificationPath(null)).toBe("/");
	});

	it("opens the today tab for the old /day/hoje the API still sends", () => {
		expect(notificationPath({ url: "/day/hoje", kind: "reminder" })).toBe("/");
	});
});
