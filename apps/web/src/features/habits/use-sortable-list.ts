import {
	type CSSProperties,
	type FocusEvent,
	type KeyboardEvent,
	type PointerEvent,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";

export interface SortableItem {
	id: string;
	/** Name read in the announcements ("Ler pego. Posição 2 de 5."). */
	label: string;
}

interface Rect {
	top: number;
	height: number;
}

interface Drag {
	id: string;
	from: number;
	over: number;
	mode: "pointer" | "keyboard";
	/** Offset of the dragged item, in pixels. */
	dy: number;
	/** Item boxes measured once when the drag starts. */
	rects: Rect[];
	/** How far the others move to make room: dragged height + gap. */
	step: number;
	pointerId?: number;
	startY?: number;
}

/** Keyboard moves land exactly on the target slot. */
function keyboardOffset(rects: Rect[], from: number, over: number): number {
	const a = rects[from]!;
	const b = rects[over]!;
	if (over > from) return b.top + b.height - (a.top + a.height);
	if (over < from) return b.top - a.top;
	return 0;
}

/**
 * A reorderable list without dependencies. Each item gets a drag handle:
 * - pointer (mouse, touch, pen): press the handle and drag; the item follows
 *   the pointer and the others make room (transform only); release to drop,
 *   Esc or a cancelled pointer to cancel;
 * - keyboard: Space/Enter lifts, ↑/↓ move, Space/Enter drops, Esc (or
 *   leaving the handle) cancels.
 * Every step is announced in `message` (an assertive live region the page
 * renders). Layout is read once per drag, in event handlers only. `onMove`
 * receives the new index; after it, the focus returns to the moved item's
 * handle (the item changes place in the DOM).
 */
export function useSortableList({
	items,
	onMove,
}: {
	items: readonly SortableItem[];
	onMove: (id: string, toIndex: number) => void;
}) {
	const [drag, setDrag] = useState<Drag | null>(null);
	const [message, setMessage] = useState("");
	const elements = useRef(new Map<string, HTMLElement>());
	const handles = useRef(new Map<string, HTMLElement>());
	const refocus = useRef<string | null>(null);
	const instructionsId = useId();
	const count = items.length;

	// The moved item changed place in the DOM: give its handle the focus back.
	useEffect(() => {
		if (refocus.current === null) return;
		handles.current.get(refocus.current)?.focus();
		refocus.current = null;
	}, [items]);

	const measure = (): Rect[] =>
		items.map((item) => {
			const box = elements.current.get(item.id)?.getBoundingClientRect();
			return { top: box?.top ?? 0, height: box?.height ?? 0 };
		});

	const start = (id: string, index: number, mode: Drag["mode"], extra = {}) => {
		const rects = measure();
		const first = rects[0];
		const gap =
			rects.length > 1 && first
				? rects[1]!.top - (first.top + first.height)
				: 0;
		setDrag({
			id,
			from: index,
			over: index,
			mode,
			dy: 0,
			rects,
			step: (rects[index]?.height ?? 0) + Math.max(0, gap),
			...extra,
		});
	};

	const labelOf = (id: string) =>
		items.find((item) => item.id === id)?.label ?? "";

	const finish = (current: Drag, commit: boolean) => {
		setDrag(null);
		const name = labelOf(current.id);
		if (!commit) {
			setMessage(
				`Movimento cancelado. ${name} continua na posição ${current.from + 1}.`
			);
			return;
		}
		setMessage(`${name} solto na posição ${current.over + 1} de ${count}.`);
		if (current.over !== current.from) {
			if (current.mode === "keyboard") refocus.current = current.id;
			onMove(current.id, current.over);
		}
	};

	// Esc also cancels a pointer drag.
	useEffect(() => {
		if (drag?.mode !== "pointer") return;
		const onKey = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			finish(drag, false);
		};
		window.addEventListener("keydown", onKey, { capture: true });
		return () =>
			window.removeEventListener("keydown", onKey, { capture: true });
	});

	const itemProps = (id: string, index: number) => {
		let style: CSSProperties | undefined;
		if (drag) {
			let offset = 0;
			if (index === drag.from) offset = drag.dy;
			else if (drag.from < drag.over && index > drag.from && index <= drag.over)
				offset = -drag.step;
			else if (drag.over < drag.from && index >= drag.over && index < drag.from)
				offset = drag.step;
			style = {
				transform: offset ? `translateY(${offset}px)` : undefined,
				position: "relative",
				zIndex: index === drag.from ? 10 : undefined,
			};
		}
		const lifted = drag?.id === id;
		return {
			ref: (element: HTMLElement | null) => {
				if (element) elements.current.set(id, element);
				else elements.current.delete(id);
			},
			style,
			"data-dragging": lifted ? "" : undefined,
			// Neighbors glide aside; the dragged item follows the pointer as is.
			className:
				drag && !(lifted && drag.mode === "pointer")
					? "motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out"
					: undefined,
		};
	};

	const handleProps = (id: string, index: number) => ({
		ref: (element: HTMLElement | null) => {
			if (element) handles.current.set(id, element);
			else handles.current.delete(id);
		},
		"aria-describedby": instructionsId,
		"aria-pressed": drag?.id === id && drag.mode === "keyboard",
		onPointerDown: (event: PointerEvent<HTMLElement>) => {
			if (event.button !== 0 || drag) return;
			event.preventDefault();
			event.currentTarget.setPointerCapture?.(event.pointerId);
			start(id, index, "pointer", {
				pointerId: event.pointerId,
				startY: event.clientY,
			});
			setMessage(`${labelOf(id)} pego. Posição ${index + 1} de ${count}.`);
		},
		onPointerMove: (event: PointerEvent<HTMLElement>) => {
			if (drag?.mode !== "pointer" || event.pointerId !== drag.pointerId)
				return;
			const dy = event.clientY - (drag.startY ?? event.clientY);
			const self = drag.rects[drag.from]!;
			const center = self.top + self.height / 2 + dy;
			const over = drag.rects.filter(
				(rect, i) => i !== drag.from && rect.top + rect.height / 2 < center
			).length;
			setDrag({ ...drag, dy, over });
		},
		onPointerUp: (event: PointerEvent<HTMLElement>) => {
			if (drag?.mode === "pointer" && event.pointerId === drag.pointerId) {
				finish(drag, true);
			}
		},
		onPointerCancel: () => {
			if (drag?.mode === "pointer") finish(drag, false);
		},
		onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
			const lift = event.key === " " || event.key === "Enter";
			if (!drag) {
				if (!lift) return;
				event.preventDefault();
				start(id, index, "keyboard");
				setMessage(
					`${labelOf(id)} pego. Posição ${index + 1} de ${count}. Use as setas para cima e para baixo para mover, Espaço para soltar e Esc para cancelar.`
				);
				return;
			}
			if (drag.id !== id || drag.mode !== "keyboard") return;
			if (event.key === "ArrowUp" || event.key === "ArrowDown") {
				event.preventDefault();
				const over = Math.max(
					0,
					Math.min(count - 1, drag.over + (event.key === "ArrowUp" ? -1 : 1))
				);
				setDrag({
					...drag,
					over,
					dy: keyboardOffset(drag.rects, drag.from, over),
				});
				setMessage(`Posição ${over + 1} de ${count}.`);
			} else if (lift) {
				event.preventDefault();
				finish(drag, true);
			} else if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				finish(drag, false);
			}
		},
		onBlur: (_event: FocusEvent<HTMLElement>) => {
			if (drag?.id === id && drag.mode === "keyboard") finish(drag, false);
		},
	});

	return {
		itemProps,
		handleProps,
		message,
		instructionsId,
		dragging: drag !== null,
	};
}
