import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui input, restyled with the night design tokens.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"min-h-touch w-full min-w-0 rounded-md border px-4 text-base placeholder:text-night-subtle border-night-border-strong bg-night-bg text-night-foreground transition-colors hover:border-night-subtle focus-visible:border-night-accent-text disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-night-danger",
				className
			)}
			{...props}
		/>
	);
}

export { Input };
