import type { DescriptionBlock, Inline } from "@habits/core";
import { Linking, Text, View } from "react-native";

/** One line's nodes as nested `Text` (so it wraps as one paragraph). */
function Inlines({ nodes }: { nodes: readonly Inline[] }) {
	return nodes.map((node, index) => {
		switch (node.type) {
			case "text":
				return node.text;
			case "bold":
				return (
					<Text key={index} className="font-bold">
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
 * lines, lists get a bullet, links open outside the app.
 */
export function DescriptionText({
	blocks,
}: {
	blocks: readonly DescriptionBlock[];
}) {
	return (
		<View className="gap-3">
			{blocks.map((block, index) =>
				block.type === "paragraph" ? (
					<Text
						key={index}
						className="text-base leading-6 text-night-foreground"
					>
						{block.lines.map((line, at) => (
							<Text key={at}>
								{at > 0 ? "\n" : null}
								<Inlines nodes={line} />
							</Text>
						))}
					</Text>
				) : (
					<View key={index} className="gap-1">
						{block.items.map((item, at) => (
							<View key={at} className="flex-row gap-2">
								<Text
									importantForAccessibility="no"
									className="text-base leading-6 text-night-accent-text"
								>
									•
								</Text>
								<Text className="flex-1 text-base leading-6 text-night-foreground">
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
