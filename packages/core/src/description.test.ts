import { describe, expect, it } from "vitest";
import {
	descriptionError,
	descriptionFirstLine,
	descriptionPreview,
	hasDescription,
	parseDescription,
	parseInline,
	plainDescription,
} from "./description.ts";

const text = (value: string) => ({ type: "text", text: value }) as const;

describe("parseDescription", () => {
	it("keeps line breaks and splits paragraphs on blank lines", () => {
		expect(
			parseDescription("Ler antes de dormir.\nNo quarto.\n\nSem celular.")
		).toEqual([
			{
				type: "paragraph",
				lines: [[text("Ler antes de dormir.")], [text("No quarto.")]],
			},
			{ type: "paragraph", lines: [[text("Sem celular.")]] },
		]);
	});

	it("is empty for an empty or blank description", () => {
		expect(parseDescription("")).toEqual([]);
		expect(parseDescription("  \n \n")).toEqual([]);
	});

	it("reads Windows line breaks", () => {
		expect(parseDescription("a\r\nb")).toEqual([
			{ type: "paragraph", lines: [[text("a")], [text("b")]] },
		]);
	});

	it("makes lists from - and * items, and a paragraph after them", () => {
		expect(
			parseDescription("Treino A\n- agachamento\n* supino\nDepois alongar")
		).toEqual([
			{ type: "paragraph", lines: [[text("Treino A")]] },
			{ type: "list", items: [[text("agachamento")], [text("supino")]] },
			{ type: "paragraph", lines: [[text("Depois alongar")]] },
		]);
	});

	it("needs a space after the list marker", () => {
		expect(parseDescription("-5 graus\n*nota*")).toEqual([
			{
				type: "paragraph",
				lines: [
					[text("-5 graus")],
					[{ type: "italic", children: [text("nota")] }],
				],
			},
		]);
	});
});

describe("parseInline", () => {
	it("reads bold, italic and both", () => {
		expect(parseInline("**Duna** e *Fundação*")).toEqual([
			{ type: "bold", children: [text("Duna")] },
			text(" e "),
			{ type: "italic", children: [text("Fundação")] },
		]);
		expect(parseInline("**muito *importante* mesmo**")).toEqual([
			{
				type: "bold",
				children: [
					text("muito "),
					{ type: "italic", children: [text("importante")] },
					text(" mesmo"),
				],
			},
		]);
	});

	it("keeps loose or unclosed asterisks literal", () => {
		expect(parseInline("2 * 3 = 6")).toEqual([text("2 * 3 = 6")]);
		expect(parseInline("**sem fim")).toEqual([text("**sem fim")]);
		expect(parseInline("a*b*c")).toEqual([text("a*b*c")]);
		expect(parseInline("** **")).toEqual([text("** **")]);
	});

	it("reads named links and bare URLs, leaving trailing punctuation out", () => {
		expect(parseInline("[planilha](https://exemplo.com/p?a=1)")).toEqual([
			{ type: "link", href: "https://exemplo.com/p?a=1", label: "planilha" },
		]);
		expect(parseInline("Veja https://exemplo.com/lista.")).toEqual([
			text("Veja "),
			{
				type: "link",
				href: "https://exemplo.com/lista",
				label: "https://exemplo.com/lista",
			},
			text("."),
		]);
		expect(parseInline("(http://a.com)")).toEqual([
			text("("),
			{ type: "link", href: "http://a.com", label: "http://a.com" },
			text(")"),
		]);
	});

	it("never links other schemes", () => {
		for (const unsafe of [
			"[x](javascript:alert(1))",
			"javascript:alert(1)",
			"[x](data:text/html,oi)",
			"ftp://exemplo.com",
			"[x](//exemplo.com)",
		]) {
			const nodes = parseInline(unsafe);
			expect(nodes.some((node) => node.type === "link")).toBe(false);
			expect(
				nodes.map((node) => (node.type === "text" ? node.text : "")).join("")
			).toBe(unsafe);
		}
	});

	it("keeps headings, HTML and backticks literal", () => {
		for (const literal of [
			"# Título",
			"<b>oi</b>",
			"`código`",
			"<script>x</script>",
		]) {
			expect(parseInline(literal)).toEqual([text(literal)]);
		}
	});
});

describe("descriptionPreview", () => {
	it("shows everything when it fits in 4 lines", () => {
		const preview = descriptionPreview("a\nb\n- c\n- d");
		expect(preview.truncated).toBe(false);
		expect(preview.blocks).toEqual(parseDescription("a\nb\n- c\n- d"));
	});

	it("stops after 4 lines, counting list items as lines", () => {
		const preview = descriptionPreview(
			"Livro: Duna\n- cap 12\n- cap 13\n- cap 14\n- cap 15"
		);
		expect(preview.truncated).toBe(true);
		expect(preview.blocks).toEqual([
			{ type: "paragraph", lines: [[text("Livro: Duna")]] },
			{
				type: "list",
				items: [[text("cap 12")], [text("cap 13")], [text("cap 14")]],
			},
		]);
	});

	it("cuts a long line at the character budget with an ellipsis", () => {
		const long = "**palavra** ".repeat(60).trim();
		const preview = descriptionPreview(long, { maxChars: 20 });
		expect(preview.truncated).toBe(true);
		expect(plainOf(preview.blocks)).toBe("palavra palavra pala…");
	});

	it("does not cut a link in half", () => {
		const preview = descriptionPreview(
			"abc https://exemplo.com/um/link/longo",
			{ maxChars: 10 }
		);
		expect(preview.truncated).toBe(true);
		expect(preview.blocks).toEqual([
			{ type: "paragraph", lines: [[text("abc …")]] },
		]);
	});
});

function plainOf(blocks: ReturnType<typeof parseDescription>): string {
	return blocks
		.flatMap((block) => (block.type === "list" ? block.items : block.lines))
		.map((line) =>
			line
				.map(function flat(node): string {
					if (node.type === "text") return node.text;
					if (node.type === "link") return node.label;
					return node.children.map(flat).join("");
				})
				.join("")
		)
		.join("\n");
}

describe("plainDescription", () => {
	it("drops the marks and keeps the structure", () => {
		expect(
			plainDescription(
				"**Treino A**\n- *agachamento*\n- [planilha](https://x.com)\n\nFim"
			)
		).toBe("Treino A\n• agachamento\n• planilha\nFim");
	});
});

describe("hasDescription and descriptionError", () => {
	it("treats blank text as no description", () => {
		expect(hasDescription({ description: "" })).toBe(false);
		expect(hasDescription({ description: " \n " })).toBe(false);
		expect(hasDescription({})).toBe(false);
		expect(hasDescription({ description: "oi" })).toBe(true);
	});

	it("allows up to 5000 characters after trimming", () => {
		expect(descriptionError("a".repeat(5000))).toBeNull();
		expect(descriptionError(`  ${"a".repeat(5000)}  `)).toBeNull();
		expect(descriptionError("a".repeat(5001))).toBe(
			"A descrição pode ter até 5.000 caracteres."
		);
	});
});

describe("descriptionFirstLine", () => {
	it("is the first visible line without marks", () => {
		expect(descriptionFirstLine("**Livro:** Duna\n- cap 12")).toBe(
			"Livro: Duna"
		);
		expect(descriptionFirstLine("\n\n- *agachamento*\n- supino")).toBe(
			"• agachamento"
		);
		expect(descriptionFirstLine("[planilha](https://x.com) do treino")).toBe(
			"planilha do treino"
		);
		expect(descriptionFirstLine("")).toBe("");
	});
});
