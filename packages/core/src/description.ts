// Habit descriptions (2.12.0): plain text with a little Markdown, parsed
// here once and drawn by both apps from the same blocks. Supported: line
// breaks, blank lines between paragraphs, **bold**, *italic*, lists with
// "- " or "* ", [label](https://…) and bare http(s) URLs. Everything else
// stays literal (headings, HTML, backticks): nothing is ever HTML, and links
// are only http(s), so `javascript:` and friends stay text.
import { DESCRIPTION_MAX_LENGTH } from "@habits/contracts";

export type Inline =
	| { type: "text"; text: string }
	| { type: "bold"; children: Inline[] }
	| { type: "italic"; children: Inline[] }
	| { type: "link"; href: string; label: string };

export type DescriptionBlock =
	| { type: "paragraph"; lines: Inline[][] }
	| { type: "list"; items: Inline[][] };

const LIST_ITEM = /^\s*[-*]\s+(.*)$/;
// Alternatives in priority order at the same position: a named link, a bare
// URL, bold, italic. Italic asterisks may not touch a word or another `*`.
const INLINE =
	/\[([^\]\n]+)\]\((https?:\/\/[^\s()]+)\)|(https?:\/\/[^\s<>()]+)|\*\*(?=\S)([^\n]*?\S)\*\*|(?<![*\p{L}\p{N}])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![*\p{L}\p{N}])/gu;
// Left out of a bare URL's end: "veja https://x.com." links "https://x.com".
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;
const MAX_DEPTH = 3;

function pushText(out: Inline[], text: string): void {
	if (text === "") return;
	const last = out.at(-1);
	if (last?.type === "text") last.text += text;
	else out.push({ type: "text", text });
}

/** One line's inline nodes. */
export function parseInline(text: string, depth = 0): Inline[] {
	const out: Inline[] = [];
	if (depth >= MAX_DEPTH) {
		pushText(out, text);
		return out;
	}
	let at = 0;
	for (const match of text.matchAll(INLINE)) {
		const index = match.index;
		pushText(out, text.slice(at, index));
		const [whole, label, href, bare, bold, italic] = match;
		if (label !== undefined && href !== undefined) {
			out.push({ type: "link", href, label });
		} else if (bare !== undefined) {
			const tail = TRAILING_PUNCTUATION.exec(bare)?.[0] ?? "";
			const url = bare.slice(0, bare.length - tail.length);
			out.push({ type: "link", href: url, label: url });
			pushText(out, tail);
		} else if (bold !== undefined) {
			out.push({ type: "bold", children: parseInline(bold, depth + 1) });
		} else if (italic !== undefined) {
			out.push({ type: "italic", children: parseInline(italic, depth + 1) });
		}
		at = index + whole.length;
	}
	pushText(out, text.slice(at));
	return out;
}

/** The description as blocks: paragraphs (lines kept) and lists. */
export function parseDescription(text: string): DescriptionBlock[] {
	const blocks: DescriptionBlock[] = [];
	let paragraph: Inline[][] | null = null;
	let list: Inline[][] | null = null;
	for (const line of text.replace(/\r\n?/g, "\n").trim().split("\n")) {
		if (line.trim() === "") {
			paragraph = null;
			list = null;
			continue;
		}
		const item = LIST_ITEM.exec(line);
		if (item) {
			paragraph = null;
			if (!list) {
				list = [];
				blocks.push({ type: "list", items: list });
			}
			list.push(parseInline(item[1]!.trim()));
		} else {
			list = null;
			if (!paragraph) {
				paragraph = [];
				blocks.push({ type: "paragraph", lines: paragraph });
			}
			paragraph.push(parseInline(line.trim()));
		}
	}
	return blocks;
}

function inlineText(nodes: readonly Inline[]): string {
	return nodes
		.map((node) =>
			node.type === "text"
				? node.text
				: node.type === "link"
					? node.label
					: inlineText(node.children)
		)
		.join("");
}

/** Cuts a line to `budget` characters of visible text, ending with "…". */
function cutInline(nodes: readonly Inline[], budget: number): Inline[] {
	const out = cutNodes(nodes, budget);
	pushText(out, "…");
	return out;
}

/** Links are kept whole or left out, never cut. */
function cutNodes(nodes: readonly Inline[], budget: number): Inline[] {
	const out: Inline[] = [];
	let left = budget;
	for (const node of nodes) {
		if (left <= 0) break;
		const length = inlineText([node]).length;
		if (length <= left) {
			if (node.type === "text") pushText(out, node.text);
			else out.push(node);
			left -= length;
			continue;
		}
		if (node.type === "text") {
			pushText(out, node.text.slice(0, left).trimEnd());
		} else if (node.type !== "link") {
			out.push({ ...node, children: cutNodes(node.children, left) });
		}
		left = 0;
	}
	return out;
}

export interface DescriptionPreview {
	blocks: DescriptionBlock[];
	/** Something was left out: the app offers the full description. */
	truncated: boolean;
}

/**
 * The first `maxLines` lines (a paragraph line or a list item each), and at
 * most `maxChars` characters of visible text, for the quick look.
 */
export function descriptionPreview(
	text: string,
	{
		maxLines = 4,
		maxChars = 280,
	}: { maxLines?: number; maxChars?: number } = {}
): DescriptionPreview {
	const blocks: DescriptionBlock[] = [];
	let lines = 0;
	let chars = 0;
	let truncated = false;
	const take = (line: Inline[]): Inline[] | null => {
		if (lines >= maxLines || chars >= maxChars) {
			truncated = true;
			return null;
		}
		lines++;
		const length = inlineText(line).length;
		if (chars + length > maxChars) {
			truncated = true;
			const cut = cutInline(line, maxChars - chars);
			chars = maxChars;
			return cut;
		}
		chars += length;
		return line;
	};
	for (const block of parseDescription(text)) {
		const source = block.type === "list" ? block.items : block.lines;
		const kept: Inline[][] = [];
		for (const line of source) {
			const taken = take(line);
			if (!taken) break;
			kept.push(taken);
		}
		if (kept.length > 0) {
			blocks.push(
				block.type === "list"
					? { type: "list", items: kept }
					: { type: "paragraph", lines: kept }
			);
		}
		if (truncated) break;
	}
	return { blocks, truncated };
}

/** Visible text without marks (screen readers, one-line summaries). */
export function plainDescription(text: string): string {
	return parseDescription(text)
		.map((block) =>
			block.type === "list"
				? block.items.map((item) => `• ${inlineText(item)}`).join("\n")
				: block.lines.map(inlineText).join("\n")
		)
		.join("\n");
}

export function hasDescription(habit: { description?: string }): boolean {
	return (habit.description ?? "").trim() !== "";
}

/** The form's error for a description, or null when it can be saved. */
export function descriptionError(text: string): string | null {
	return text.trim().length > DESCRIPTION_MAX_LENGTH
		? "A descrição pode ter até 5.000 caracteres."
		: null;
}

/** Show the counter from this many characters on. */
export const DESCRIPTION_COUNTER_FROM = 4500;

/**
 * The first line of the description, without marks, for the line under the
 * habit's name on a day's row (cut by the app; list items keep "• ").
 */
export function descriptionFirstLine(text: string): string {
	return plainDescription(text).split("\n", 1)[0] ?? "";
}
