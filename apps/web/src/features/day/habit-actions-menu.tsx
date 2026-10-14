import type { Habit } from "@habits/contracts";
import {
	type HabitActionId,
	habitActions,
	habitMenuLabel,
	type RescheduleAvailability,
} from "@habits/core";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	CalendarArrowUpIcon,
	EllipsisVerticalIcon,
	type LucideIcon,
	NotebookTextIcon,
	PencilIcon,
} from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { cn } from "@/lib/utils.ts";
import type { OccurrenceTarget } from "./use-reschedule-habit.ts";

/** The habit a menu acts on: what the rows of a day carry. */
export type MenuHabit = Habit;

/**
 * "Adiar" on a row (2.16.0): whether it shows (core's
 * `rescheduleAvailability`) and the occurrence it would move.
 */
export interface RescheduleMenu {
	availability: RescheduleAvailability;
	occurrence: OccurrenceTarget;
	/** "Arquivar"/"Desarquivar" too (false on the preview days). */
	archive?: boolean;
}

export type HabitActionHandler = (
	habit: MenuHabit,
	action: HabitActionId,
	occurrence?: OccurrenceTarget
) => void;

const ICONS: Record<HabitActionId, LucideIcon> = {
	edit: PencilIcon,
	reschedule: CalendarArrowUpIcon,
	description: NotebookTextIcon,
	archive: ArchiveIcon,
	unarchive: ArchiveRestoreIcon,
};

interface MenuParts {
	Item: ComponentType<{
		className?: string;
		"aria-disabled"?: boolean;
		onSelect?: (event: Event) => void;
		children: ReactNode;
	}>;
	Label: ComponentType<{
		className?: string;
		title?: string;
		children: ReactNode;
	}>;
	Separator: ComponentType<{ className?: string }>;
}

const DROPDOWN: MenuParts = {
	Item: DropdownMenuItem,
	Label: DropdownMenuLabel,
	Separator: DropdownMenuSeparator,
};

const CONTEXT: MenuParts = {
	Item: ContextMenuItem,
	Label: ContextMenuLabel,
	Separator: ContextMenuSeparator,
};

/**
 * The items of a habit's menu (2.15.0), from core's declarative
 * `habitActions` (labels and order in one place). Rendered by both the
 * "more options" button and the right click, so the two never drift.
 */
function HabitActionItems({
	parts: { Item, Label, Separator },
	habit,
	reschedule,
	onAction,
}: {
	parts: MenuParts;
	habit: MenuHabit;
	reschedule?: RescheduleMenu;
	onAction: HabitActionHandler;
}) {
	return (
		<>
			<Label title={habit.name} className="max-w-64 truncate">
				{habit.name}
			</Label>
			<Separator />
			{habitActions(habit, reschedule?.availability, {
				archive: reschedule?.archive ?? true,
			}).map((action) => {
				const Icon = ICONS[action.id];
				// 2.16.0: shown but unavailable, with the reason as its note. Not
				// Radix's `disabled` (arrows skip those, so a screen reader would
				// never reach the reason): focusable, announced as unavailable,
				// and selecting it does nothing (the menu stays open).
				const unavailable = action.disabledReason !== undefined;
				const note = action.disabledReason ?? action.hint;
				return (
					<Item
						key={action.id}
						aria-disabled={unavailable || undefined}
						onSelect={(event) => {
							if (unavailable) {
								event.preventDefault();
								return;
							}
							onAction(habit, action.id, reschedule?.occurrence);
						}}
						className={cn(
							note && "py-2",
							unavailable &&
								"cursor-not-allowed text-night-muted data-[highlighted]:bg-night-surface-raised",
							action.careful &&
								"text-night-warning [&_svg]:text-night-warning data-[highlighted]:bg-night-warning-surface"
						)}
					>
						<Icon aria-hidden="true" />
						{note ? (
							<span className="flex flex-col">
								<span>{action.label}</span>
								<span className="text-xs font-normal text-night-muted">
									{note}
								</span>
							</span>
						) : (
							action.label
						)}
					</Item>
				);
			})}
		</>
	);
}

/**
 * The always visible "more options" button (⋮) at the row's end: its own
 * 44px target, outside the row's label, so it never marks the habit. Radix
 * gives `aria-haspopup="menu"`, `aria-expanded`, the menu roles, arrows, Esc
 * and the focus back on the button.
 */
export function HabitActionsButton({
	habit,
	reschedule,
	onAction,
}: {
	habit: MenuHabit;
	reschedule?: RescheduleMenu;
	onAction: HabitActionHandler;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					data-habit-menu-trigger=""
					aria-label={habitMenuLabel(habit.name)}
					className="shrink-0 text-night-muted hover:text-night-foreground data-[state=open]:bg-night-surface-raised data-[state=open]:text-night-foreground"
				>
					<EllipsisVerticalIcon aria-hidden="true" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<HabitActionItems
					parts={DROPDOWN}
					habit={habit}
					reschedule={reschedule}
					onAction={onAction}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The same menu at the pointer, on a right click inside the row (the
 * `<li>`, passed as the only child). The browser's own menu is cancelled
 * there only. A touch or pen press turns the trigger off until the next
 * mouse press, so the web never opens it with a long press (Radix would, and
 * Android Chrome also sends `contextmenu` on a long press): touch keeps the
 * browser's behavior. Closing puts the focus back on the row's checkbox, or
 * on its "more options" button when there is none.
 */
export function HabitRowMenu({
	habit,
	reschedule,
	onAction,
	children,
}: {
	habit: MenuHabit;
	reschedule?: RescheduleMenu;
	onAction: HabitActionHandler;
	children: ReactNode;
}) {
	const [touch, setTouch] = useState(false);
	const [row, setRow] = useState<HTMLElement | null>(null);
	return (
		<ContextMenu>
			<ContextMenuTrigger
				asChild
				disabled={touch}
				ref={setRow}
				onPointerDown={(event) => {
					const fromTouch = event.pointerType !== "mouse";
					// Stops Radix's own long-press timer for touch and pen.
					if (fromTouch) event.preventDefault();
					if (fromTouch !== touch) setTouch(fromTouch);
				}}
			>
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent
				className="w-64"
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					const target =
						row?.querySelector<HTMLElement>(
							'[role="checkbox"]:not(:disabled)'
						) ?? row?.querySelector<HTMLElement>("[data-habit-menu-trigger]");
					target?.focus();
				}}
			>
				<HabitActionItems
					parts={CONTEXT}
					habit={habit}
					reschedule={reschedule}
					onAction={onAction}
				/>
			</ContextMenuContent>
		</ContextMenu>
	);
}
