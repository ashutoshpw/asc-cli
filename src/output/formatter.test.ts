import { describe, expect, test } from "bun:test";
import {
	formatMarkdown,
	formatRaw,
	formatTable,
	getOutputFormat,
} from "./formatter";

describe("output formatter", () => {
	test("resolves supported output formats and defaults to pretty", () => {
		expect(getOutputFormat({ raw: true, output: "table" })).toBe("raw");
		expect(getOutputFormat({ output: "table" })).toBe("table");
		expect(getOutputFormat({ output: "md" })).toBe("markdown");
		expect(getOutputFormat({ output: "unknown" })).toBe("pretty");
	});

	test("formats raw JSON without changing the value", () => {
		expect(formatRaw({ name: "demo", count: 2 })).toBe(
			'{"name":"demo","count":2}',
		);
	});

	test("renders JSON API resources as a readable table", () => {
		const output = formatTable({
			data: [
				{
					type: "apps",
					id: "app-1",
					attributes: {
						name: "Demo",
						bundleId: "com.example.demo",
						sku: "DEMO",
						primaryLocale: "en-US",
					},
				},
			],
		});

		expect(output).toContain("name");
		expect(output).toContain("Demo");
		expect(output).toContain("com.example.demo");
	});

	test("handles empty and key-value values", () => {
		expect(formatTable([])).toBe("(empty)");
		expect(formatTable({ enabled: true, count: 3, values: [1, 2] })).toContain(
			"enabled",
		);
		expect(formatTable(null)).toBe("null");
	});

	test("renders markdown and escapes cell separators", () => {
		const output = formatMarkdown([{ name: "one|two", note: "line\nbreak" }]);

		expect(output).toContain("| name | note |");
		expect(output).toContain("one\\|two");
		expect(output).toContain("line break");
		expect(formatMarkdown([])).toBe("_No data_");
	});
});
