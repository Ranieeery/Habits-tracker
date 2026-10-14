import type { DescriptionBlock, Inline } from "@habits/core";
import { Linking, Text, View } from "react-native";

/**
 * Typography of a description, in one place (2.14.1, DESIGN.md "Descrição de
 * hábito"): `preview` is the quick look (secondary text, compact), `reading`
 * the habit's screen (main text, roomier lines). Sizes follow the system's
 * font scale.
 */
const VARIANT = {
	preview: { gap: "gap-3", text: "text-[15px] leading-6 text-night-muted" },
	reading: { gap: "gap-4", text: "text-base leading-7 text-night-foreground" },
} as const;

/** One line's nodes as nested `Text` (so it wraps as one paragraph). */
function Inlines({ nodes }: { nodes: readonly Inline[] }) {
	return nodes.map((node, index) => {
		switch (node.type) {
			case "text":
				return node.text;
			case "bold":
				return (
					<Text key={index} className="font-bold text-night-foreground">
						<Inlines nodes={node.children} />
					</Text>
				);
			case "italic":
				return (
					<Text key={index} className="italic">
						<Inlines nodes={node.children} />
					</Text>
				);
			case "link":
				// Only http(s) reaches here (core `parseDescription`).
				return (
					<Text
						key={index}
						accessibilityRole="link"
						onPress={() => void Linking.openURL(node.href)}
						className="text-night-accent-text underline"
					>
						{node.label}
					</Text>
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
 * lines, lists get a bullet, links open outside the app. Long words break
 * by character on their own (Android), so nothing widens the sheet.
 */
export function DescriptionText({
	blocks,
	variant = "reading",
}: {
	blocks: readonly DescriptionBlock[];
	variant?: keyof typeof VARIANT;
}) {
	const { gap, text } = VARIANT[variant];
	return (
		<View className={gap}>
			{blocks.map((block, index) =>
				block.type === "paragraph" ? (
					<Text key={index} className={text}>
						{block.lines.map((line, at) => (
							<Text key={at}>
								{at > 0 ? "\n" : null}
								<Inlines nodes={line} />
							</Text>
						))}
					</Text>
				) : (
					<View key={index} className="gap-1.5">
						{block.items.map((item, at) => (
							<View key={at} className="flex-row gap-2.5 pl-1">
								<Text
									importantForAccessibility="no"
									className={`${text} text-night-accent-text`}
								>
									•
								</Text>
								<Text className={`flex-1 ${text}`}>
									<Inlines nodes={item} />
								</Text>
							</View>
						))}
					</View>
				)
			)}
		</View>
	);
}
