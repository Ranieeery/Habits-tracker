import type { HeatmapLevel } from "@habits/core";
import { Link } from "@tanstack/react-router";
import { CloudOffIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { cn } from "@/lib/utils.ts";
import { CELL_SIZE, LEVEL_CLASSES, WEEKDAY_COLUMN } from "./heatmap-utils.ts";

const SKELETON_WEEKS = Array.from({ length: 53 }, (_, i) => i);
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** The grid's shape while the year loads (breathes only with motion on). */
export function HeatmapSkeleton() {
	return (
		<div role="status" aria-busy="true" className="overflow-hidden pt-1 pb-3">
			<span className="sr-only">Carregando o histórico…</span>
			<div aria-hidden="true" className="flex flex-col gap-1">
				<div className="h-5" />
				{WEEKDAYS.map((weekday) => (
					<div key={weekday} className="flex gap-1">
						<div className={cn(WEEKDAY_COLUMN, "shrink-0")} />
						{SKELETON_WEEKS.map((week) => (
							<div
								key={week}
								data-skeleton-cell=""
								className={cn(
									CELL_SIZE,
									"shrink-0 rounded-md bg-night-heat-0 md:rounded-sm"
								)}
							/>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

const STAIRS: HeatmapLevel[] = [0, 1, 2, 3, 4, 5];

/** No habits yet: the levels as a staircase and the way to start. */
export function HeatmapEmpty() {
	return (
		<div className="flex flex-col items-start gap-5 rounded-xl border border-night-border bg-night-surface p-6 sm:flex-row sm:items-center sm:gap-8">
			<div aria-hidden="true" className="flex items-end gap-1.5">
				{STAIRS.map((level) => (
					<div
						key={level}
						className={cn("w-5 rounded-sm", LEVEL_CLASSES[level])}
						style={{ height: `${12 + level * 8}px` }}
					/>
				))}
			</div>
			<div className="flex flex-col items-start gap-3">
				<div className="flex flex-col gap-1">
					<h2 className="font-display text-xl font-bold text-balance">
						Seu ano começa com um hábito
					</h2>
					<p className="text-sm text-night-muted">
						Cada dia em que você cumpre seus hábitos acende um quadrado aqui.
					</p>
				</div>
				<Link to="/habits" className={buttonVariants({ variant: "night" })}>
					Criar primeiro hábito
				</Link>
			</div>
		</div>
	);
}

export function HeatmapError({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	return (
		<div
			role="alert"
			className="flex flex-col items-start gap-4 rounded-xl border border-night-danger/40 bg-night-danger-surface/60 p-6 sm:flex-row sm:items-center"
		>
			<CloudOffIcon
				className="size-8 shrink-0 text-night-danger"
				aria-hidden="true"
			/>
			<div className="flex flex-1 flex-col gap-1">
				<p className="font-semibold">Não foi possível carregar o histórico</p>
				<p className="text-sm text-night-muted">{errorMessage(error)}</p>
			</div>
			<Button variant="night-secondary" onClick={onRetry}>
				Tentar de novo
			</Button>
		</div>
	);
}
