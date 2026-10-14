import type { ReschedulesResponse } from "@habits/contracts";
import {
	NO_RESCHEDULES,
	type RescheduleIndex,
	rescheduleIndex,
	type ScheduleOptions,
} from "@habits/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { reschedulesQuery } from "./queries.ts";
import { useServices } from "./services.ts";
import { useUserTimeZone } from "./use-today.ts";

// One index per response, shared by every component that reads it (a list
// of habit cards builds it once).
const indexes = new WeakMap<ReschedulesResponse, RescheduleIndex>();
function indexFor(data: ReschedulesResponse): RescheduleIndex {
	let index = indexes.get(data);
	if (!index) {
		index = rescheduleIndex(data.reschedules, data.completions);
		indexes.set(data, index);
	}
	return index;
}

/**
 * What core's schedule rules need on the web (2.16.0): the user's time zone
 * and their postponed occurrences (`GET /v1/reschedules`), for what the web
 * computes locally (preview days, cards, "Próximos", the habit form). Until
 * the postponements load there are none; `ready` says when they did.
 */
export function useScheduleOptions(): {
	options: ScheduleOptions;
	ready: boolean;
	error: unknown;
	refetch: () => unknown;
} {
	const { api } = useServices();
	const timeZone = useUserTimeZone();
	const query = useQuery(reschedulesQuery(api));
	const options = useMemo(
		() => ({
			timeZone,
			reschedules: query.data ? indexFor(query.data) : NO_RESCHEDULES,
		}),
		[timeZone, query.data]
	);
	return {
		options,
		ready: query.data !== undefined,
		error: query.isError ? query.error : null,
		refetch: query.refetch,
	};
}
