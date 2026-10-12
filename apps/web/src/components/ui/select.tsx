import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// Native select styled like `Input` (accessible and keyboard-friendly on every
// platform; no Radix select needed for short fixed lists).
function Select({ className, ...props }: React.ComponentProps<"select">) {
	return (
		<select
			data-slot="select"
			className={cn(
				"min-h-touch min-w-0 rounded-md border border-border bg-surface px-3 text-base text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
				className
			)}
			{...props}
		/>
	);
}

export { Select };
