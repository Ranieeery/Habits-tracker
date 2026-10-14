import type { Habit } from "@habits/contracts";
import { descriptionPreview } from "@habits/core";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, NotebookTextIcon } from "lucide-react";
import { useMemo } from "react";
import { DescriptionText } from "@/components/description-text.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover.tsx";

/**
 * The note icon of a day's row (2.12.0) and its quick look (2.14.1 layout,
 * DESIGN.md "Descrição de hábito"): the name in the display face (two lines
 * at most), the first lines of the description (core `descriptionPreview`),
 * faded out at the end when something was left out, and a footer that always
 * leads to the habit's page.
 */
export function DescriptionPopover({
	habit,
}: {
	habit: Pick<Habit, "id" | "name" | "description">;
}) {
	const preview = useMemo(
		() => descriptionPreview(habit.description),
		[habit.description]
	);
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
				aria-label={`Descrição de ${habit.name}`}
				className="flex w-[min(24rem,calc(100vw-2rem))] flex-col p-0"
			>
				<div className="flex flex-col gap-2 px-4 pt-4 pb-3">
					<p
						title={habit.name}
						className="line-clamp-2 font-display text-lg leading-snug font-semibold text-balance wrap-anywhere"
					>
						{habit.name}
					</p>
					<DescriptionText
						blocks={preview.blocks}
						variant="preview"
						faded={preview.truncated}
					/>
				</div>
				<Link
					to="/habits/$habitId"
					params={{ habitId: habit.id }}
					className="group flex min-h-touch items-center justify-between gap-2 rounded-b-xl border-t border-night-border-strong px-4 text-sm font-medium text-night-accent-text -outline-offset-2 hover:bg-night-accent/15"
				>
					Abrir descrição completa
					<ArrowRightIcon
						className="size-4 motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</Link>
			</PopoverContent>
		</Popover>
	);
}
