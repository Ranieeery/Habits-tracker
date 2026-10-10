import { GlobeIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { useServices } from "@/lib/services.ts";
import { useUserTimeZone } from "@/lib/use-today.ts";
import { useUpdateTimeZone } from "./use-update-time-zone.ts";

const DISMISS_PREFIX = "habits:tz-dismissed:";

function dismissKey(device: string, saved: string) {
	return `${DISMISS_PREFIX}${device}|${saved}`;
}

function readDismissed(key: string): boolean {
	try {
		return localStorage.getItem(key) === "1";
	} catch {
		return false;
	}
}

function writeDismissed(key: string) {
	try {
		localStorage.setItem(key, "1");
	} catch {
		// Storage unavailable (private mode): dismissing lasts for this visit.
	}
}

/**
 * Discreet notice when the device's time zone differs from the saved one.
 * Never changes the setting on its own: the user picks "Atualizar" or
 * "Manter" (remembered for this pair of zones).
 */
export function TimezoneBanner() {
	const { deviceTimeZone } = useServices();
	const saved = useUserTimeZone();
	const device = deviceTimeZone();
	const key = dismissKey(device, saved);
	const [dismissedKey, setDismissedKey] = useState<string | null>(null);
	const update = useUpdateTimeZone();

	if (device === saved || dismissedKey === key || readDismissed(key)) {
		return null;
	}

	return (
		<aside
			aria-label="Fuso horário diferente"
			className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center"
		>
			<GlobeIcon
				className="hidden size-5 shrink-0 text-muted sm:block"
				aria-hidden="true"
			/>
			<p className="flex-1 text-muted">
				Este dispositivo está em{" "}
				<strong className="text-foreground">{device}</strong>, mas seus dias são
				contados em <strong className="text-foreground">{saved}</strong>.
			</p>
			<div className="flex gap-2">
				<Button
					size="sm"
					variant="secondary"
					disabled={update.isPending}
					onClick={() => update.mutate(device)}
				>
					Atualizar para {device}
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={() => {
						writeDismissed(key);
						setDismissedKey(key);
					}}
				>
					Manter
				</Button>
			</div>
		</aside>
	);
}
