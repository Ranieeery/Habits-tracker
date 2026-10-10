import { isValidTimeZone } from "@habits/core";

/**
 * Whether to offer switching the saved time zone to the device's: only when
 * they differ, the device zone is a real IANA zone and the user has not chosen
 * to keep the saved one for this pair.
 */
export function shouldOfferTimeZoneUpdate(
	device: string | null,
	saved: string,
	kept: ReadonlySet<string>
): device is string {
	if (!device || device === saved) return false;
	if (!isValidTimeZone(device)) return false;
	return !kept.has(timeZonePairKey(device, saved));
}

export function timeZonePairKey(device: string, saved: string): string {
	return `${device}|${saved}`;
}
