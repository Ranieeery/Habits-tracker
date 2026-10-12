import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// Native select styled like `Input` (accessible and keyboard-friendly on every
// platform; no Radix select needed for short fixed lists).
function Select({ className, ...props }: React.ComponentProps<"select">) {
	return (
		<select
			data-slot="select"
			className={cn(
				// Explicit background and color: Windows draws native options otherwise.
				"min-h-touch min-w-0 rounded-md border px-3 text-base [&>option]:bg-night-surface [&>option]:text-night-foreground border-night-border-strong bg-night-bg text-night-foreground transition-colors hover:border-night-subtle focus-visible:border-night-accent-text disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-night-danger",
				className
			)}
			{...props}
		/>
	);
}

export { Select };
