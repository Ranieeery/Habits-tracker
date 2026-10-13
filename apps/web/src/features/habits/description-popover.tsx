import type { Habit } from "@habits/contracts";
import { descriptionPreview } from "@habits/core";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, NotebookTextIcon } from "lucide-react";
import { DescriptionText } from "@/components/description-text.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover.tsx";

/**
 * The note icon of a day's row (2.12.0) and its quick look: the first lines
 * of the description (core `descriptionPreview`) and, when something was left
 * out, "Abrir descrição completa" (the habit's page).
 */
export function DescriptionPopover({
	habit,
}: {
	habit: Pick<Habit, "id" | "name" | "description">;
}) {
	const preview = descriptionPreview(habit.description);
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Descrição de ${habit.name}`}
					className="shrink-0"
				>
					<NotebookTextIcon aria-hidden="true" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3"
			>
				<p className="font-display font-semibold">{habit.name}</p>
				<DescriptionText blocks={preview.blocks} className="text-sm" />
				{preview.truncated && (
					<Link
						to="/habits/$habitId"
						params={{ habitId: habit.id }}
						className="inline-flex min-h-touch items-center gap-1 self-start text-sm font-medium text-night-accent-text hover:underline"
					>
						Abrir descrição completa
						<ArrowRightIcon className="size-4" aria-hidden="true" />
					</Link>
				)}
			</PopoverContent>
		</Popover>
	);
}
