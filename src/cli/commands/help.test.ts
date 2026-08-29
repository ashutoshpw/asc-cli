import { describe, expect, test } from "bun:test";

const commands = [
	"analytics",
	"apps",
	"auth",
	"builds",
	"bundle-ids",
	"certificates",
	"devices",
	"iap",
	"profiles",
	"reviews",
	"subscriptions",
	"testflight",
	"users",
	"versions",
];

describe("CLI command help", () => {
	test("renders help without requiring credentials for every command", async () => {
		for (const command of commands) {
			const process = Bun.spawn(
				["bun", "run", "src/index.ts", command, "--help"],
				{
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			const [exitCode, stdout, stderr] = await Promise.all([
				process.exited,
				new Response(process.stdout).text(),
				new Response(process.stderr).text(),
			]);

			expect(exitCode, `${command} stderr: ${stderr}`).toBe(0);
			expect(stdout).toContain("DESCRIPTION");
			expect(stdout).toContain("USAGE");
		}
	});
});
