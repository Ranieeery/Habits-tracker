// The sync indicator's text, tone and icon for a status (pt-BR). Pure.
import dayjs from "dayjs";
import { CLOCK_SKEW_WARNING_MS, type SyncStatus } from "@/data/sync/engine.ts";

export type SyncTone = "ok" | "busy" | "pending" | "offline" | "danger";

export interface SyncLabel {
	tone: SyncTone;
	label: string;
	icon:
		| "cloud-check-outline"
		| "cloud-sync-outline"
		| "cloud-upload-outline"
		| "cloud-off-outline"
		| "cloud-alert-outline";
}

const plural = (n: number, one: string, many: string) =>
	`${n} ${n === 1 ? one : many}`;

export function syncLabel(
	status: Pick<
		SyncStatus,
		"state" | "error" | "pending" | "failed" | "lastSyncedAt"
	>
): SyncLabel {
	const pending = plural(status.pending, "pendente", "pendentes");
	if (status.failed > 0) {
		return {
			tone: "danger",
			label: plural(status.failed, "falha", "falhas"),
			icon: "cloud-alert-outline",
		};
	}
	if (status.state === "syncing") {
		return {
			tone: "busy",
			label: "Sincronizando…",
			icon: "cloud-sync-outline",
		};
	}
	if (status.state === "offline") {
		return {
			tone: "offline",
			label: status.pending > 0 ? `Offline · ${pending}` : "Offline",
			icon: "cloud-off-outline",
		};
	}
	if (status.error === "unauthorized") {
		return {
			tone: "danger",
			label: "Sessão expirada",
			icon: "cloud-alert-outline",
		};
	}
	if (status.error === "server") {
		return {
			tone: "pending",
			label:
				status.pending > 0
					? `Erro ao sincronizar · ${pending}`
					: "Erro ao sincronizar",
			icon: "cloud-alert-outline",
		};
	}
	if (status.pending > 0) {
		return { tone: "pending", label: pending, icon: "cloud-upload-outline" };
	}
	return {
		tone: "ok",
		label:
			status.lastSyncedAt === null
				? "Sincronizado"
				: `Sincronizado às ${dayjs(status.lastSyncedAt).format("HH:mm")}`,
		icon: "cloud-check-outline",
	};
}

/** Whether the device clock looks wrong compared to the server's. */
export function isClockSkewed(skewMs: number | null): boolean {
	return skewMs !== null && Math.abs(skewMs) > CLOCK_SKEW_WARNING_MS;
}
