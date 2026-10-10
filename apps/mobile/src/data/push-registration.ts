// This device's registration with the server, shared by the reminder hooks
// and sign-out.
import type { Services } from "./services.ts";

type Deps = Pick<Services, "pushDevice" | "notifications">;

/** Expo token already sent this app run (the server keeps it until removed). */
let registeredToken: string | null = null;
/** One registration at a time: callers share the one in flight. */
let inFlight: Promise<boolean> | null = null;

/**
 * Registers this device's token unless this run already sent the same one;
 * returns false without a token (no permission or no push support).
 */
export function registerThisDevice(deps: Deps): Promise<boolean> {
	inFlight ??= register(deps).finally(() => {
		inFlight = null;
	});
	return inFlight;
}

async function register({ pushDevice, notifications }: Deps) {
	const registration = await pushDevice.registration();
	if (!registration) return false;
	if (registration.token === registeredToken) return true;
	const id = await notifications.registerDevice(
		registration.token,
		registration.label
	);
	await pushDevice.storeId(id);
	registeredToken = registration.token;
	return true;
}

/** Before signing out, while the session still exists. Never throws. */
export async function unregisterThisDevice({
	pushDevice,
	notifications,
}: Deps): Promise<void> {
	registeredToken = null;
	try {
		const id = await pushDevice.storedId();
		if (id) await notifications.unregisterDevice(id);
	} catch {
		// Offline or already gone: the token stops working on uninstall and
		// the server removes it on DeviceNotRegistered.
	}
	await pushDevice.storeId(null).catch(() => undefined);
}
