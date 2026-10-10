import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button.tsx";
import { errorMessage } from "@/lib/errors.ts";
import { cn } from "@/lib/utils.ts";

/** Full error state with a retry button. */
export function ErrorState({
	error,
	onRetry,
	className,
}: {
	error: unknown;
	onRetry?: () => void;
	className?: string;
}) {
	return (
		<div
			role="alert"
			className={cn(
				"flex flex-col items-center gap-4 rounded-xl border border-danger/40 bg-danger-surface/40 p-6 text-center",
				className
			)}
		>
			<AlertCircleIcon className="size-8 text-danger" aria-hidden="true" />
			<p className="text-foreground">{errorMessage(error)}</p>
			{onRetry && (
				<Button variant="secondary" onClick={onRetry}>
					Tentar novamente
				</Button>
			)}
		</div>
	);
}

export function EmptyState({
	title,
	description,
	action,
}: {
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
			<p className="text-lg font-bold">{title}</p>
			{description && <p className="text-sm text-muted">{description}</p>}
			{action}
		</div>
	);
}

export function Spinner({ label = "Carregando…" }: { label?: string }) {
	return (
		<div
			role="status"
			className="flex min-h-40 items-center justify-center gap-3 text-muted"
		>
			<Loader2Icon className="size-6 animate-spin text-violet-600" />
			<span>{label}</span>
		</div>
	);
}

/** Inline form error, announced to screen readers. */
export function FieldError({
	id,
	children,
}: {
	id?: string;
	children: React.ReactNode;
}) {
	if (!children) return null;
	return (
		<p id={id} role="alert" className="text-sm text-danger">
			{children}
		</p>
	);
}
