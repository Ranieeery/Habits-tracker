import type { DescriptionBlock, Inline } from "@habits/core";
import { cn } from "@/lib/utils.ts";

function Inlines({ nodes }: { nodes: readonly Inline[] }) {
	return nodes.map((node, index) => {
		switch (node.type) {
			case "text":
				return node.text;
			case "bold":
				return (
					<strong key={index} className="font-semibold">
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
						className="break-words text-night-accent-text underline underline-offset-2 hover:text-night-foreground"
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
 * A habit description (2.12.0) from core's blocks: paragraphs keep their
 * lines, lists are lists, links open in a new tab. Never HTML from the text.
 */
export function DescriptionText({
	blocks,
	className,
}: {
	blocks: readonly DescriptionBlock[];
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-3 leading-relaxed", className)}>
			{blocks.map((block, index) =>
				block.type === "paragraph" ? (
					<p key={index} className="break-words">
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
						className="flex list-disc flex-col gap-1 pl-5 marker:text-night-accent-text"
					>
						{block.items.map((item, at) => (
							<li key={at} className="break-words">
								<Inlines nodes={item} />
							</li>
						))}
					</ul>
				)
			)}
		</div>
	);
}
