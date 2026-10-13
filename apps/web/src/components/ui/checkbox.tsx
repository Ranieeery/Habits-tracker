import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils.ts";

// shadcn/ui checkbox: night box, green ("done") when checked with a dark
// check mark (9.8:1). The mark stays mounted so it can fade and shrink out
// when unchecked instead of vanishing (transform/opacity, motion-safe only).
function Checkbox({
	className,
	...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer flex size-7 shrink-0 items-center justify-center rounded-md border-2 border-night-border-strong bg-night-bg transition-colors disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-night-success data-[state=checked]:bg-night-success",
				className
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				forceMount
				data-slot="checkbox-indicator"
				className="grid place-content-center text-night-bg data-[state=unchecked]:scale-50 data-[state=unchecked]:opacity-0 motion-safe:transition-[opacity,transform] motion-safe:duration-150 motion-safe:ease-out"
			>
				<CheckIcon className="size-4" strokeWidth={3} />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
