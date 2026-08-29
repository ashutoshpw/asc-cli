import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { GlobalOptions } from "../../parser";

function globalOptions(): GlobalOptions {
	return {
		help: false,
		version: false,
		raw: true,
		debug: false,
		apiDebug: false,
		output: "pretty",
	};
}

describe("apps list filters", () => {
	afterEach(() => {
		mock.restore();
	});

	test("keeps name filtering and adds the bundle-ID filter", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		const getMock = mock(async (path: string) => {
			expect(path).toBe(
				"/v1/apps?limit=200&filter%5Bname%5D=Example+App&filter%5BbundleId%5D=com.example.app",
			);
			return { data: [] };
		});

		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => ({
				keyId: "key",
				issuerId: "issuer",
				privateKey: "private",
			}),
		}));
		mock.module("../../../api/client", () => ({
			Client: { fromCredentials: async () => ({ get: getMock }) },
		}));

		const { listApps } = await import("./index");
		await listApps({
			global: globalOptions(),
			args: {
				command: ["apps", "list"],
				options: {
					filter: "Example App",
					"bundle-id": "com.example.app",
				},
				positionals: [],
			},
		});

		expect(getMock).toHaveBeenCalledTimes(1);
		logSpy.mockRestore();
	});
});
