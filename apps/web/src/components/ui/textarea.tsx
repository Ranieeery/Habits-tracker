import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// Multi-line field with the look of `Input` (2.12.0: habit descriptions).
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"min-h-24 w-full min-w-0 resize-y rounded-md border px-4 py-3 text-base placeholder:text-night-subtle border-night-border-strong bg-night-bg text-night-foreground transition-colors hover:border-night-subtle focus-visible:border-night-accent-text disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-night-danger",
				className
			)}
			{...props}
		/>
	);
}

export { Textarea };
