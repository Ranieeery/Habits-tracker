import { TimestampMs, Uuid } from "./primitives.ts";

/**
 * Fields every syncable record carries. `deleted_at` set means the record is a
 * tombstone, kept so the deletion reaches other devices.
 */
export const SyncableFields = {
	id: Uuid,
	created_at: TimestampMs,
	updated_at: TimestampMs,
	deleted_at: TimestampMs.nullable(),
};
