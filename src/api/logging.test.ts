import { describe, expect, spyOn, test } from "bun:test";
import { logRequest, logResponse, redactUrl } from "./logging";

describe("HTTP logging", () => {
	test("redacts sensitive query parameters", () => {
		const output = redactUrl(
			"https://is1-ssl.mzstatic.com/file?token=secret&signature=also-secret&ok=1",
		);

		expect(output).toContain("token=%5BREDACTED%5D");
		expect(output).toContain("signature=%5BREDACTED%5D");
		expect(output).toContain("ok=1");
		expect(output).not.toContain("secret");
	});

	test("logs request metadata and optional body", () => {
		const consoleSpy = spyOn(console, "error").mockImplementation(() => {});
		try {
			logRequest(
				"POST",
				"https://api.appstoreconnect.apple.com/v1/apps?key=secret",
				{ name: "demo" },
				true,
			);

			expect(consoleSpy).toHaveBeenCalledTimes(2);
			expect(consoleSpy.mock.calls[0]?.[0]).not.toContain("secret");
			expect(consoleSpy.mock.calls[1]?.[0]).toContain('"name": "demo"');
		} finally {
			consoleSpy.mockRestore();
		}
	});

	test("logs response status", () => {
		const consoleSpy = spyOn(console, "error").mockImplementation(() => {});
		try {
			logResponse(
				new Response(null, { status: 204, statusText: "No Content" }),
			);
			expect(consoleSpy).toHaveBeenCalledWith("[http] 204 No Content");
		} finally {
			consoleSpy.mockRestore();
		}
	});
});
