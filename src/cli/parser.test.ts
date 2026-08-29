import { describe, expect, test } from "bun:test";
import { getGlobalOptions, parseArgs } from "./parser";

describe("CLI parser", () => {
	test("extracts a command path before flags", () => {
		const parsed = parseArgs([
			"apps",
			"list",
			"--profile",
			"team",
			"--api-debug",
			"--output",
			"table",
		]);

		expect(parsed.command).toEqual(["apps", "list"]);
		expect(parsed.positionals).toEqual([]);
		expect(parsed.options).toMatchObject({
			profile: "team",
			"api-debug": true,
			output: "table",
		});
	});

	test("normalizes global option values", () => {
		const parsed = parseArgs([
			"--version",
			"--raw",
			"--debug",
			"--api-debug",
			"--profile",
			"release",
		]);

		expect(getGlobalOptions(parsed.options)).toEqual({
			help: false,
			version: true,
			raw: true,
			debug: true,
			apiDebug: true,
			profile: "release",
			output: "pretty",
		});
	});

	test("applies defaults and preserves positionals", () => {
		const parsed = parseArgs(["iap", "get", "product-1", "--raw"]);

		expect(parsed.command).toEqual(["iap", "get", "product-1"]);
		expect(parsed.options.raw).toBe(true);
		expect(getGlobalOptions(parsed.options).output).toBe("pretty");
	});

	test("accepts an explicitly empty string option value", () => {
		const parsed = parseArgs(["apps", "list", "--output="]);

		expect(parsed.command).toEqual(["apps", "list"]);
		expect(parsed.options.output).toBe("");
		expect(parsed.positionals).toEqual([]);
	});
});
