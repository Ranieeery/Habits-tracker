// Everything the UI needs from the outside world, created once per app run.
import { getCalendars } from "expo-localization";
import { createContext, use } from "react";
import { type AuthService, createAuthService } from "./auth.ts";
import {
	createAuthenticatedApiClient,
	createRemoteRepository,
} from "./remote-repository.ts";
import type { HabitsRepository } from "./repository.ts";

/** Current instant in UTC ms. */
export type Clock = () => number;

export interface Services {
	repository: HabitsRepository;
	auth: AuthService;
	/** The only source of "now" in the app (see `systemClock`). */
	now: Clock;
	/** IANA time zone the device is set to, or null if unknown. */
	deviceTimeZone: () => string | null;
}

/** The single place in the mobile app that reads the system clock. */
export const systemClock: Clock = () => Date.now();

export function systemTimeZone(): string | null {
	return getCalendars()[0]?.timeZone ?? null;
}

/** `EXPO_PUBLIC_API_URL` is inlined by Metro from `.env` (see `.env.example`). */
function apiBaseUrl(): string {
	const url = process.env.EXPO_PUBLIC_API_URL;
	if (!url) {
		throw new Error(
			"EXPO_PUBLIC_API_URL is not set: copy apps/mobile/.env.example to .env"
		);
	}
	return url.replace(/\/+$/, "");
}

export function createServices(): Services {
	const baseUrl = apiBaseUrl();
	const auth = createAuthService(baseUrl);
	const api = createAuthenticatedApiClient(baseUrl, () => auth.getCookie());
	return {
		repository: createRemoteRepository(api),
		auth,
		now: systemClock,
		deviceTimeZone: systemTimeZone,
	};
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
	const services = use(ServicesContext);
	if (!services) throw new Error("useServices outside <ServicesContext>");
	return services;
}
