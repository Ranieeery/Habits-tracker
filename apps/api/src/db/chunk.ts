// D1 accepts at most 100 bound parameters per statement: multi-row inserts and
// `IN (...)` lists are split into chunks that fit.

import { getTableColumns, type Table } from "drizzle-orm";

/** D1 limit on bound parameters per statement. */
export const MAX_PARAMS = 100;

/**
 * Parameters per row of a multi-row insert: Drizzle binds every column,
 * defaults included.
 */
export function columnCount(table: Table): number {
	return Object.keys(getTableColumns(table)).length;
}

/** Splits `items` so each chunk uses at most `MAX_PARAMS - reserved` params. */
export function chunk<T>(
	items: readonly T[],
	paramsPerItem: number,
	reserved = 0
): T[][] {
	const size = Math.max(1, Math.floor((MAX_PARAMS - reserved) / paramsPerItem));
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}
