import { resolveCloseRequest } from "@habits/core";
import { useRef, useState } from "react";

/**
 * Leaving a habit form (2.16.2). `request(close)` is the one way out for
 * every exit the user takes (a sheet's "Fechar", a tap outside it, Android
 * back and its gesture, a screen's header arrow): core's
 * `resolveCloseRequest` closes at once without changes, asks "Descartar
 * alterações?" with changes, and with the question already open only closes
 * it (a second back means "Continuar editando"). `HabitForm` reports its
 * state through `onDirtyChange`. Closings from the flow itself (saved,
 * archived) skip this and never ask.
 */
export function useDiscardGuard() {
	const [dirty, setDirty] = useState(false);
	const [asking, setAsking] = useState(false);
	// What "Descartar" does: the close that was asked for.
	const pending = useRef<(() => void) | null>(null);

	const request = (close: () => void) => {
		switch (resolveCloseRequest({ dirty, asking })) {
			case "close":
				close();
				return;
			case "ask":
				pending.current = close;
				setAsking(true);
				return;
			case "keep":
				pending.current = null;
				setAsking(false);
				return;
		}
	};

	return {
		dirty,
		asking,
		onDirtyChange: setDirty,
		request,
		keep: () => {
			pending.current = null;
			setAsking(false);
		},
		discard: () => {
			const close = pending.current;
			pending.current = null;
			setAsking(false);
			setDirty(false);
			close?.();
		},
	};
}
