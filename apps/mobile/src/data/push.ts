// This device and expo-notifications: the Android channel, permission, the
// Expo push token and the id the API gave this device. Asking for permission
// happens only from `requestPermission` (the reminders switch), never on
// launch.
import { colors } from "@habits/design-tokens";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { type PushPermission, permissionFrom } from "./push-logic.ts";

/** Same id the API sends in `channelId` (`ANDROID_CHANNEL_ID`). */
export const REMINDER_CHANNEL_ID = "reminders";

const DEVICE_ID_KEY = "habits_push_device_id";

export interface DeviceRegistration {
	token: string;
	label: string | null;
}

export interface PushDevice {
	/** Creates the Android channel; must exist before asking (Android 13+). */
	ensureChannel(): Promise<void>;
	permission(): Promise<PushPermission>;
	/** Shows the system prompt when Android still allows it. */
	requestPermission(): Promise<PushPermission>;
	/** The Expo push token, or null without permission or push support. */
	registration(): Promise<DeviceRegistration | null>;
	storedId(): Promise<string | null>;
	storeId(id: string | null): Promise<void>;
}

function projectId(): string | undefined {
	const extra = Constants.expoConfig?.extra as
		{ eas?: { projectId?: string } } | undefined;
	return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function ensureChannel() {
	if (Platform.OS !== "android") return;
	await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
		name: "Lembretes",
		description: "Lembrete diário dos hábitos pendentes",
		importance: Notifications.AndroidImportance.HIGH,
		lightColor: colors.violet[600],
	});
}

export function createPushDevice(): PushDevice {
	return {
		ensureChannel,
		async permission() {
			if (!Device.isDevice) return "unavailable";
			return permissionFrom(await Notifications.getPermissionsAsync());
		},
		async requestPermission() {
			if (!Device.isDevice) return "unavailable";
			await ensureChannel();
			const current = await Notifications.getPermissionsAsync();
			if (current.granted || !current.canAskAgain)
				return permissionFrom(current);
			return permissionFrom(await Notifications.requestPermissionsAsync());
		},
		async registration() {
			if (!Device.isDevice) return null;
			const { granted } = await Notifications.getPermissionsAsync();
			if (!granted) return null;
			await ensureChannel();
			// Network call; throws without Firebase set up (google-services.json).
			const { data } = await Notifications.getExpoPushTokenAsync({
				projectId: projectId(),
			});
			return { token: data, label: Device.modelName ?? null };
		},
		storedId: () => SecureStore.getItemAsync(DEVICE_ID_KEY),
		storeId: (id) =>
			id
				? SecureStore.setItemAsync(DEVICE_ID_KEY, id)
				: SecureStore.deleteItemAsync(DEVICE_ID_KEY),
	};
}
