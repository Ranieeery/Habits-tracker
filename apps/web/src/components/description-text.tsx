import type { DescriptionBlock, Inline } from "@habits/core";
import { memo } from "react";
import { cn } from "@/lib/utils.ts";

function Inlines({ nodes }: { nodes: readonly Inline[] }) {
	return nodes.map((node, index) => {
		switch (node.type) {
			case "text":
				return node.text;
			case "bold":
				return (
					<strong key={index} className="font-semibold text-night-foreground">
						<Inlines nodes={node.children} />
					</strong>
				);
			case "italic":
				return (
					<em key={index}>
						<Inlines nodes={node.children} />
					</em>
				);
			case "link":
				// Only http(s) reaches here (core `parseDescription`).
				return (
					<a
						key={index}
						href={node.href}
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-sm text-night-accent-text underline decoration-night-accent-text/50 underline-offset-2 hover:decoration-night-accent-text"
					>
						{node.label}
					</a>
				);
			default: {
				const unknown: never = node;
				return String(unknown);
			}
		}
	});
}

/**
 * Typography of a description, in one place (2.14.1, DESIGN.md "Descrição de
 * hábito"): `preview` is the quick look (secondary text, compact), `reading`
 * the habit's page (main text, roomier lines).
 */
const VARIANT = {
	preview: "gap-3 text-sm leading-6 text-night-muted",
	reading: "gap-4 text-[15px] leading-7 text-night-foreground",
} as const;

/**
 * A habit description (2.12.0) from core's blocks: paragraphs keep their
 * lines, lists are lists, links open in a new tab. Never HTML from the text.
 * Long words and URLs wrap anywhere instead of widening the container.
 */
export const DescriptionText = memo(function DescriptionText({
	blocks,
	variant = "reading",
	faded = false,
	className,
}: {
	blocks: readonly DescriptionBlock[];
	variant?: keyof typeof VARIANT;
	/** The text goes on past what is shown: its end fades out (a mask). */
	faded?: boolean;
	className?: string;
}) {
	return (
		<div
			data-faded={faded || undefined}
			className={cn(
				"flex flex-col wrap-anywhere",
				VARIANT[variant],
				// About the last two lines, whatever the text's height.
				faded && "mask-b-from-[calc(100%-3rem)]",
				className
			)}
		>
			{blocks.map((block, index) =>
				block.type === "paragraph" ? (
					<p key={index}>
						{block.lines.map((line, at) => (
							<span key={at}>
								{at > 0 && <br />}
								<Inlines nodes={line} />
							</span>
						))}
					</p>
				) : (
					<ul
						key={index}
						className="flex list-disc flex-col gap-1.5 pl-5 marker:text-night-accent-text"
					>
						{block.items.map((item, at) => (
							<li key={at} className="pl-0.5">
								<Inlines nodes={item} />
							</li>
						))}
					</ul>
				)
			)}
		</div>
	);
});
