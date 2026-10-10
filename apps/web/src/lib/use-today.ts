import type { CalendarDate } from "@habits/contracts";
import { todayIn } from "@habits/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { settingsQuery } from "./queries.ts";
import { useServices } from "./services.ts";

const RECHECK_MS = 60_000;

/** Re-evaluates "today" when the app comes back to the foreground, and every minute. */
function subscribe(onChange: () => void) {
	const onVisibility = () => {
		if (document.visibilityState === "visible") onChange();
	};
	window.addEventListener("focus", onChange);
	document.addEventListener("visibilitychange", onVisibility);
	const timer = window.setInterval(onChange, RECHECK_MS);
	return () => {
		window.removeEventListener("focus", onChange);
		document.removeEventListener("visibilitychange", onVisibility);
		window.clearInterval(timer);
	};
}

/** The user's time zone, from their saved settings (never the device's). */
export function useUserTimeZone(): string {
	const { api } = useServices();
	return useSuspenseQuery(settingsQuery(api)).data.timezone;
}

/**
 * The user's local date in their saved time zone. Updates when the day turns
 * while the app is open (on focus, on visibilitychange and once a minute).
 */
export function useToday(): CalendarDate {
	const { now } = useServices();
	const timeZone = useUserTimeZone();
	const getSnapshot = useCallback(
		() => todayIn(timeZone, now()),
		[timeZone, now]
	);
	return useSyncExternalStore(subscribe, getSnapshot);
}
