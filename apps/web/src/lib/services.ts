// Everything the UI needs from the outside world, injected so tests can swap
// the network, the clock and the device time zone.
import type { ApiClient } from "@habits/api-client";
import { createContext, use } from "react";
import type { AuthService } from "./auth.ts";
import type { PushService } from "./push.ts";

/** Current instant in UTC ms. */
export type Clock = () => number;

export interface Services {
	api: ApiClient;
	auth: AuthService;
	/** Notification permission and this browser's push subscription. */
	push: PushService;
	/** The only source of "now" in the app (see `systemClock`). */
	now: Clock;
	/** IANA time zone the device is set to. */
	deviceTimeZone: () => string;
}

/** The single place in the web app that reads the system clock. */
export const systemClock: Clock = () => Date.now();

export function systemTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
	const services = use(ServicesContext);
	if (!services) throw new Error("useServices outside <ServicesContext>");
	return services;
}
