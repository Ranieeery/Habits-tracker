import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui input, restyled with the design tokens.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"min-h-touch w-full min-w-0 rounded-md border border-border bg-surface px-4 text-base text-foreground transition-colors placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
				className
			)}
			{...props}
		/>
	);
}

export { Input };
