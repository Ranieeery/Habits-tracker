import { Label as LabelPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui label.
function Label({
	className,
	...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
	return (
		<LabelPrimitive.Root
			data-slot="label"
			className={cn(
				"text-sm leading-tight font-semibold select-none peer-disabled:opacity-50",
				className
			)}
			{...props}
		/>
	);
}

export { Label };
