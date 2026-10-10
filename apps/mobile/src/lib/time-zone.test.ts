import { describe, expect, it } from "vitest";
import { shouldOfferTimeZoneUpdate, timeZonePairKey } from "./time-zone.ts";

const SAVED = "America/Sao_Paulo";

describe("shouldOfferTimeZoneUpdate", () => {
	it("stays quiet when the zones match or the device zone is unknown", () => {
		expect(shouldOfferTimeZoneUpdate(SAVED, SAVED, new Set())).toBe(false);
		expect(shouldOfferTimeZoneUpdate(null, SAVED, new Set())).toBe(false);
		expect(shouldOfferTimeZoneUpdate("Not/AZone", SAVED, new Set())).toBe(
			false
		);
	});

	it("offers the device zone when it differs", () => {
		expect(shouldOfferTimeZoneUpdate("Europe/Lisbon", SAVED, new Set())).toBe(
			true
		);
	});

	it("respects a kept pair, but asks again for a different pair", () => {
		const kept = new Set([timeZonePairKey("Europe/Lisbon", SAVED)]);
		expect(shouldOfferTimeZoneUpdate("Europe/Lisbon", SAVED, kept)).toBe(false);
		expect(shouldOfferTimeZoneUpdate("Asia/Tokyo", SAVED, kept)).toBe(true);
	});
});
