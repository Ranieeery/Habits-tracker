import {
	DEFAULT_TIME_ZONE,
	type UpdateUserSettingsRequest,
	type UserSettings,
} from "@habits/contracts";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { fromUserSettingsRow, toUserSettingsRow } from "../db/records.ts";
import { userSettings } from "../db/schema.ts";

export function defaultSettings(now: number): UserSettings {
	return {
		timezone: DEFAULT_TIME_ZONE,
		reminder_time: null,
		morning_digest_enabled: true,
		show_titles_in_notifications: true,
		created_at: now,
		updated_at: now,
	};
}

/** The user's settings, created with the defaults if missing. */
export async function ensureSettings(
	db: Db,
	userId: string,
	now: number
): Promise<UserSettings> {
	const row = await db.query.userSettings.findFirst({
		where: eq(userSettings.user_id, userId),
	});
	if (row) return fromUserSettingsRow(row);
	const [inserted] = await db
		.insert(userSettings)
		.values(toUserSettingsRow(userId, defaultSettings(now)))
		.onConflictDoNothing()
		.returning();
	if (inserted) return fromUserSettingsRow(inserted);
	// Created concurrently by another request.
	const existing = await db.query.userSettings.findFirst({
		where: eq(userSettings.user_id, userId),
	});
	return fromUserSettingsRow(existing!);
}

export async function updateSettings(
	db: Db,
	userId: string,
	changes: UpdateUserSettingsRequest,
	now: number
): Promise<UserSettings> {
	const current = await ensureSettings(db, userId, now);
	const next = toUserSettingsRow(userId, {
		...current,
		...changes,
		updated_at: now,
	});
	const [row] = await db
		.update(userSettings)
		.set(next)
		.where(eq(userSettings.user_id, userId))
		.returning();
	return fromUserSettingsRow(row!);
}
