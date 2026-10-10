import type { CalendarDate, UserSettings } from "@habits/contracts";
import { todayIn } from "@habits/core";
import { createContext, use, useCallback, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useServices } from "./services.ts";

const RECHECK_MS = 30_000;

/**
 * Re-evaluates "today" when the app returns to the foreground and every 30 s
 * while it is open, so the day turns at local midnight without a restart.
 */
function subscribe(onChange: () => void) {
	const appState = AppState.addEventListener("change", (status) => {
		if (status === "active") onChange();
	});
	const timer = setInterval(onChange, RECHECK_MS);
	return () => {
		appState.remove();
		clearInterval(timer);
	};
}

/** The signed-in user's settings, loaded before any authenticated screen. */
export const SettingsContext = createContext<UserSettings | null>(null);

/**
 * The saved time zone on its own: a string, so changing another setting (the
 * reminder time) does not re-render every screen that only needs "today".
 */
export const TimeZoneContext = createContext<string | null>(null);

export function useLoadedSettings(): UserSettings {
	const settings = use(SettingsContext);
	if (!settings) throw new Error("useLoadedSettings outside <SettingsGate>");
	return settings;
}

/** The user's time zone, from their saved settings (never the device's). */
export function useUserTimeZone(): string {
	const timeZone = use(TimeZoneContext);
	if (!timeZone) throw new Error("useUserTimeZone outside <SettingsGate>");
	return timeZone;
}

/** The user's local date in their saved time zone; follows the day turning. */
export function useToday(): CalendarDate {
	const { now } = useServices();
	const timeZone = useUserTimeZone();
	const getSnapshot = useCallback(
		() => todayIn(timeZone, now()),
		[timeZone, now]
	);
	return useSyncExternalStore(subscribe, getSnapshot);
}
