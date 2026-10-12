import type { CalendarDate } from "@habits/contracts";
import type { DayEditState } from "@habits/core";
import { LockIcon, PencilIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { formatShortDate } from "@/lib/format.ts";

/**
 * The bar above the habits of a day that is not today:
 * - a past day in the window: "Somente leitura" and "Editar este dia", which
 *   asks for confirmation (Cancelar has the initial focus; Radix traps the
 *   focus and closes on Esc), then "Editando dia passado" with "Concluir
 *   edição", which locks the day again;
 * - an older day: why it cannot be edited;
 * - a future day: read-only.
 * The unlock lives in the caller's state only (never stored).
 */
export function PastDayBar({
	date,
	state,
	backfillDays,
	unlocked,
	onUnlock,
	onLock,
}: {
	date: CalendarDate;
	state: Exclude<DayEditState, "today">;
	backfillDays: number;
	unlocked: boolean;
	onUnlock: () => void;
	onLock: () => void;
}) {
	const [confirming, setConfirming] = useState(false);
	const editRef = useRef<HTMLButtonElement>(null);
	const finishRef = useRef<HTMLButtonElement>(null);
	const cancelRef = useRef<HTMLButtonElement>(null);
	const wasUnlocked = useRef(unlocked);

	// The button that started the change goes away: move the focus to the
	// one that replaced it.
	useEffect(() => {
		if (wasUnlocked.current === unlocked) return;
		wasUnlocked.current = unlocked;
		(unlocked ? finishRef : editRef).current?.focus();
	}, [unlocked]);

	if (state === "past_locked") {
		return (
			<p className="flex items-center gap-2 text-sm text-muted">
				<LockIcon className="size-4" aria-hidden="true" />
				Fora do período de edição de {backfillDays} dias
			</p>
		);
	}
	if (state === "future") {
		return (
			<p className="flex items-center gap-2 text-sm text-muted">
				<LockIcon className="size-4" aria-hidden="true" />
				Somente leitura: este dia ainda não chegou.
			</p>
		);
	}
	if (unlocked) {
		return (
			<div
				role="status"
				className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/60 bg-warning-surface px-4 py-2"
			>
				<p className="flex items-center gap-2 font-semibold text-warning">
					<TriangleAlertIcon className="size-5" aria-hidden="true" />
					Editando dia passado
				</p>
				<Button ref={finishRef} variant="secondary" onClick={onLock}>
					Concluir edição
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<p className="flex items-center gap-2 text-sm text-muted">
				<LockIcon className="size-4" aria-hidden="true" />
				Somente leitura.
			</p>
			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogTrigger asChild>
					<Button ref={editRef} variant="outline">
						<PencilIcon className="text-accent" aria-hidden="true" />
						Editar este dia
					</Button>
				</DialogTrigger>
				<DialogContent
					role="alertdialog"
					onOpenAutoFocus={(event) => {
						event.preventDefault();
						cancelRef.current?.focus();
					}}
					onCloseAutoFocus={(event) => {
						// After "Editar" the trigger is gone; the effect above
						// focuses "Concluir edição".
						if (wasUnlocked.current) event.preventDefault();
					}}
				>
					<DialogHeader>
						<DialogTitle>Editar o dia {formatShortDate(date)}?</DialogTitle>
						<DialogDescription>
							Este dia já passou. Ao alterar, o mapa de hábitos e as sequências
							serão recalculados.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-wrap justify-end gap-2">
						<Button
							ref={cancelRef}
							variant="ghost"
							onClick={() => setConfirming(false)}
						>
							Cancelar
						</Button>
						<Button
							onClick={() => {
								setConfirming(false);
								onUnlock();
							}}
						>
							Editar
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
