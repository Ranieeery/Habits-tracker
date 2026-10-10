import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn/ui toaster, dark only (no theme provider), colors from the tokens.
function Toaster(props: ToasterProps) {
	return (
		<Sonner
			theme="dark"
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4 text-success-hover" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4 text-danger" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "var(--color-surface)",
					"--normal-text": "var(--color-foreground)",
					"--normal-border": "var(--color-border)",
					"--border-radius": "var(--radius-lg)",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
}

export { Toaster };
