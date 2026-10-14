import { DISCARD_CHANGES } from "@habits/core";
import { useRef } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog.tsx";

/**
 * "Descartar alterações?" (2.16.2): an alert dialog over the habit form's
 * dialog, opened when closing it with unsaved changes. "Continuar editando"
 * has the focus, so an accidental Enter keeps the changes; Esc and a click
 * outside close only this question (Radix gives them to the topmost layer)
 * and the focus goes back to where it was in the form.
 */
export function DiscardChangesDialog({
	open,
	onKeepEditing,
	onDiscard,
}: {
	open: boolean;
	onKeepEditing: () => void;
	onDiscard: () => void;
}) {
	const keepRef = useRef<HTMLButtonElement>(null);
	const discarded = useRef(false);
	// Radix gives the focus back to a trigger, and this question has none.
	const previous = useRef<HTMLElement | null>(null);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onKeepEditing();
			}}
		>
			<DialogContent
				role="alertdialog"
				hideClose
				className="duration-150 sm:max-w-sm"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					discarded.current = false;
					previous.current =
						document.activeElement instanceof HTMLElement
							? document.activeElement
							: null;
					keepRef.current?.focus();
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					// Discarded: the form is gone and its own dialog gives the
					// focus back; kept: back to the field it was on.
					if (discarded.current) return;
					// A click outside blurs the field first (focus on the body):
					// then back into the form's dialog, never out of it.
					const target =
						previous.current?.isConnected && previous.current !== document.body
							? previous.current
							: document.querySelector<HTMLElement>(
									'[role="dialog"][data-state="open"]'
								);
					target?.focus();
				}}
			>
				<DialogHeader className="pr-0">
					<DialogTitle>{DISCARD_CHANGES.title}</DialogTitle>
					<DialogDescription>{DISCARD_CHANGES.body}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-wrap justify-end gap-2">
					<Button ref={keepRef} onClick={onKeepEditing}>
						{DISCARD_CHANGES.keep}
					</Button>
					<Button
						variant="careful"
						onClick={() => {
							discarded.current = true;
							onDiscard();
						}}
					>
						{DISCARD_CHANGES.discard}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
