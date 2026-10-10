// This device's registration with the server, shared by the reminder hooks
// and sign-out.
import type { Services } from "./services.ts";

/** Registers (or refreshes) this device's token; returns false without one. */
export async function registerThisDevice({
	pushDevice,
	notifications,
}: Pick<Services, "pushDevice" | "notifications">): Promise<boolean> {
	const registration = await pushDevice.registration();
	if (!registration) return false;
	const id = await notifications.registerDevice(
		registration.token,
		registration.label
	);
	await pushDevice.storeId(id);
	return true;
}

/** Before signing out, while the session still exists. Never throws. */
export async function unregisterThisDevice({
	pushDevice,
	notifications,
}: Pick<Services, "pushDevice" | "notifications">): Promise<void> {
	try {
		const id = await pushDevice.storedId();
		if (id) await notifications.unregisterDevice(id);
	} catch {
		// Offline or already gone: the token stops working on uninstall and
		// the server removes it on DeviceNotRegistered.
	}
	await pushDevice.storeId(null).catch(() => undefined);
}
