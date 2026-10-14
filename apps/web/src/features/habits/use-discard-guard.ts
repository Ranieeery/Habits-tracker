import { resolveCloseRequest } from "@habits/core";
import { useState } from "react";

/**
 * Closing a habit form's dialog (2.16.2). Radix calls `onOpenChange(false)`
 * for Esc, a click outside and the "Fechar" button: all three go through
 * core's `resolveCloseRequest`, which closes at once without changes, asks
 * "Descartar alterações?" with changes, and ignores a repeated request while
 * the question is open. `close` is the dialog's plain closing; the flow's own
 * closings (saved, created) call it directly and never ask. `HabitForm`
 * reports its state through `onDirtyChange`; `confirm` goes to
 * `DiscardChangesDialog`.
 */
export function useDiscardGuard(close: () => void) {
	const [dirty, setDirty] = useState(false);
	const [asking, setAsking] = useState(false);

	const onOpenChange = (open: boolean) => {
		if (open) return;
		switch (resolveCloseRequest({ dirty, asking })) {
			case "close":
				close();
				return;
			case "ask":
				setAsking(true);
				return;
			case "keep":
				return;
		}
	};

	return {
		onDirtyChange: setDirty,
		onOpenChange,
		confirm: {
			open: asking,
			onKeepEditing: () => setAsking(false),
			onDiscard: () => {
				setAsking(false);
				setDirty(false);
				close();
			},
		},
	};
}
