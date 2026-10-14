import type { Habit } from "@habits/contracts";
import { type HabitActionId, habitActions, habitMenuLabel } from "@habits/core";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
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

/** The habit a menu acts on: what the rows of a day carry. */
export type MenuHabit = Habit;

export type HabitActionHandler = (
	habit: MenuHabit,
	action: HabitActionId
) => void;

const ICONS: Record<HabitActionId, LucideIcon> = {
	edit: PencilIcon,
	description: NotebookTextIcon,
	archive: ArchiveIcon,
	unarchive: ArchiveRestoreIcon,
};

interface MenuParts {
	Item: ComponentType<{
		className?: string;
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
	onAction,
}: {
	parts: MenuParts;
	habit: MenuHabit;
	onAction: HabitActionHandler;
}) {
	return (
		<>
			<Label title={habit.name} className="max-w-64 truncate">
				{habit.name}
			</Label>
			<Separator />
			{habitActions(habit).map((action) => {
				const Icon = ICONS[action.id];
				return (
					<Item
						key={action.id}
						onSelect={() => onAction(habit, action.id)}
						className={cn(
							action.hint && "py-2",
							action.careful &&
								"text-night-warning [&_svg]:text-night-warning data-[highlighted]:bg-night-warning-surface"
						)}
					>
						<Icon aria-hidden="true" />
						{action.hint ? (
							<span className="flex flex-col">
								<span>{action.label}</span>
								<span className="text-xs font-normal text-night-muted">
									{action.hint}
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
	onAction,
}: {
	habit: MenuHabit;
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
				<HabitActionItems parts={DROPDOWN} habit={habit} onAction={onAction} />
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
	onAction,
	children,
}: {
	habit: MenuHabit;
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
				<HabitActionItems parts={CONTEXT} habit={habit} onAction={onAction} />
			</ContextMenuContent>
		</ContextMenu>
	);
}
