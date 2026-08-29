import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { getGlobalOptions, parseArgs } from "./parser";
import { type CommandContext, registry, routeCommand } from "./router";

describe("command router", () => {
	afterEach(() => {
		// Keep output-based tests quiet and restore process behavior.
		process.exit = originalExit;
	});

	const originalExit = process.exit;

	test("finds nested commands and reports remaining arguments", () => {
		registry.register({
			name: "router-test",
			description: "router test",
			subcommands: {
				list: { name: "list", description: "list" },
			},
		});

		expect(registry.findByPath(["router-test", "list"])).toEqual({
			command: { name: "list", description: "list" },
			remainingPath: [],
		});
		expect(registry.findByPath(["missing"])).toBeUndefined();
	});

	test("re-parses command options before executing", async () => {
		let received: CommandContext | undefined;
		registry.register({
			name: "router-execute-test",
			description: "router execute test",
			options: {
				value: { type: "string", description: "test value" },
			},
			execute: async (ctx) => {
				received = ctx;
			},
		});

		const rawArgs = ["router-execute-test", "--value", "expected"];
		const parsed = parseArgs(rawArgs);
		await routeCommand(parsed, getGlobalOptions(parsed.options), rawArgs);

		expect(received?.args.options.value).toBe("expected");
	});

	test("exits with a useful message for an unknown command", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		const exitSpy = spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT:${code}`);
		}) as never);

		try {
			const parsed = parseArgs(["definitely-not-a-command"]);
			await expect(
				routeCommand(parsed, getGlobalOptions(parsed.options), [
					"definitely-not-a-command",
				]),
			).rejects.toThrow("EXIT:1");
			expect(errorSpy).toHaveBeenCalled();
			expect(errorSpy.mock.calls[0]?.[0]).toContain("Unknown command");
		} finally {
			errorSpy.mockRestore();
			exitSpy.mockRestore();
		}
	});
});
