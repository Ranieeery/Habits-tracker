// Everything the UI needs from the outside world, created once per JS context
// (the app, or the background sync task when the app is not running).
import type { UserSettings } from "@habits/contracts";
import { uuidV7 } from "@habits/core";
import { getRandomBytes } from "expo-crypto";
import { getCalendars } from "expo-localization";
import { createContext, use } from "react";
import { type AuthService, createAuthService } from "./auth.ts";
import { openExpoDatabase } from "./local/expo-sql.ts";
import { createLocalRepository } from "./local/local-repository.ts";
import { createLocalStore, type LocalStore } from "./local/store.ts";
import { createPushDevice, type PushDevice } from "./push.ts";
import {
	authenticatedFetch,
	createAuthenticatedApiClient,
	createRemoteNotifications,
	createRemoteRepository,
} from "./remote-repository.ts";
import type {
	HabitsRepository,
	NotificationsRepository,
} from "./repository.ts";
import { createSyncEngine, type SyncEngine } from "./sync/engine.ts";
import { createSyncTransport, observingFetch } from "./sync/transport.ts";

/** Current instant in UTC ms. */
export type Clock = () => number;

/** What the sync engine tells the UI (set by the root layout). */
export interface SyncHandlers {
	onUnauthorized: () => void;
	onDataChanged: () => void;
	onSettingsChanged: (settings: UserSettings) => void;
}

export interface Services {
	/** Local-first: reads and writes the device database (see `local/`). */
	repository: HabitsRepository;
	notifications: NotificationsRepository;
	/** Permission, channel and push token of this device. */
	pushDevice: PushDevice;
	auth: AuthService;
	/** The device database (sign-in binds it to a user, sign-out wipes it). */
	local: LocalStore;
	sync: SyncEngine;
	setSyncHandlers(handlers: Partial<SyncHandlers>): void;
	/** The only source of "now" in the app (see `systemClock`). */
	now: Clock;
	/** IANA time zone the device is set to, or null if unknown. */
	deviceTimeZone: () => string | null;
	/** A new UUID v7 (record and mutation ids). */
	newId: () => string;
}

/** The single place in the mobile app that reads the system clock. */
export const systemClock: Clock = () => Date.now();

export function systemTimeZone(): string | null {
	return getCalendars()[0]?.timeZone ?? null;
}

/** Sync requests give up after this and count as offline. */
const SYNC_TIMEOUT_MS = 20_000;

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

function createServices(): Services {
	const baseUrl = apiBaseUrl();
	const auth = createAuthService(baseUrl);
	const cookieFetch = authenticatedFetch(() => auth.getCookie());
	const api = createAuthenticatedApiClient(baseUrl, cookieFetch);
	const sync = observingFetch(cookieFetch, systemClock, SYNC_TIMEOUT_MS);
	const syncApi = createAuthenticatedApiClient(baseUrl, sync.fetch);
	const newId = () => uuidV7(systemClock(), getRandomBytes(16));

	const handlers: SyncHandlers = {
		onUnauthorized: () => undefined,
		onDataChanged: () => undefined,
		onSettingsChanged: () => undefined,
	};
	const remote = createRemoteRepository(api);
	const local = createLocalStore(() => openExpoDatabase());
	const engine = createSyncEngine({
		store: local,
		transport: createSyncTransport(syncApi, sync.observer),
		now: systemClock,
		random: Math.random,
		timers: {
			setTimeout: (callback, ms) => setTimeout(callback, ms),
			clearTimeout: (handle) =>
				clearTimeout(handle as ReturnType<typeof setTimeout>),
		},
		owner: newId(),
		onUnauthorized: () => handlers.onUnauthorized(),
		onDataChanged: () => handlers.onDataChanged(),
		onSettingsChanged: (settings) => handlers.onSettingsChanged(settings),
	});

	return {
		repository: createLocalRepository({
			store: local,
			remoteSettings: remote,
			now: systemClock,
			newId,
			onWrite: () => engine.notifyLocalWrite(),
		}),
		notifications: createRemoteNotifications(api),
		pushDevice: createPushDevice(),
		auth,
		local,
		sync: engine,
		setSyncHandlers: (next) => Object.assign(handlers, next),
		now: systemClock,
		deviceTimeZone: systemTimeZone,
		newId,
	};
}

let instance: Services | null = null;

/** The services of this JS context (created on first use). */
export function getServices(): Services {
	instance ??= createServices();
	return instance;
}

/**
 * Binds the local database to the signed-in user (wiping another user's
 * data first) and starts syncing.
 */
export async function prepareLocalData(
	services: Pick<Services, "local" | "sync">,
	userId: string
): Promise<void> {
	await services.local.ensureUser(userId);
	await services.sync.refresh();
	services.sync.start();
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
	const services = use(ServicesContext);
	if (!services) throw new Error("useServices outside <ServicesContext>");
	return services;
}
