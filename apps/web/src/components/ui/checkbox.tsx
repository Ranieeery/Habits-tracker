import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui checkbox with the legacy look: surface box, green when checked.
function Checkbox({
	className,
	...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer flex size-8 shrink-0 items-center justify-center rounded-md border-2 border-border bg-surface transition-colors disabled:cursor-not-allowed data-[state=checked]:border-success data-[state=checked]:bg-success",
				className
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="grid place-content-center text-foreground"
			>
				<CheckIcon className="size-5" strokeWidth={3} />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
