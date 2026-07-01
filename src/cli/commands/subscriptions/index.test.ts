import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import type { GlobalOptions } from "../../parser";

const CREDS = {
	keyId: "KEY123",
	issuerId: "ISSUER123",
	privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
	source: "env" as const,
};

function makeGlobal(overrides: Partial<GlobalOptions> = {}): GlobalOptions {
	return {
		help: false,
		version: false,
		raw: false,
		debug: false,
		apiDebug: false,
		output: "pretty",
		...overrides,
	};
}

describe("subscriptions parseStateFilter", () => {
	let exitSpy: ReturnType<typeof spyOn>;
	let errorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
		exitSpy = spyOn(process, "exit").mockImplementation(((code?: number) => {
			throw new Error(`EXIT:${code}`);
		}) as never);
	});

	afterEach(() => {
		errorSpy.mockRestore();
		exitSpy.mockRestore();
	});

	test("returns undefined when no value given", async () => {
		const { parseStateFilter } = await import("./index");
		expect(parseStateFilter(undefined)).toBeUndefined();
	});

	test("normalizes and accepts comma-separated states", async () => {
		const { parseStateFilter } = await import("./index");
		expect(parseStateFilter("approved,in_review")).toEqual([
			"APPROVED",
			"IN_REVIEW",
		]);
	});

	test("exits 1 with a helpful message for an invalid state", async () => {
		const { parseStateFilter } = await import("./index");
		expect(() => parseStateFilter("NOPE")).toThrow("EXIT:1");
		const message = errorSpy.mock.calls[0]?.[0] as string;
		expect(message).toContain("NOPE");
		expect(message).toContain("APPROVED");
	});
});

describe("mergeGroupSubscriptions", () => {
	test("flattens subscriptions from multiple groups", async () => {
		const { mergeGroupSubscriptions } = await import("./index");
		const result = mergeGroupSubscriptions([
			[{ id: "1" }, { id: "2" }],
			[{ id: "3" }],
			[],
		]);
		expect(result).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
	});
});

describe("subscriptions list", () => {
	let exitSpy: ReturnType<typeof spyOn>;
	let errorSpy: ReturnType<typeof spyOn>;
	let logSpy: ReturnType<typeof spyOn>;
	const originalAppId = process.env.ASC_APP_ID;

	beforeEach(() => {
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
		logSpy = spyOn(console, "log").mockImplementation(() => {});
		exitSpy = spyOn(process, "exit").mockImplementation(((code?: number) => {
			throw new Error(`EXIT:${code}`);
		}) as never);
		process.env.ASC_APP_ID = undefined;
	});

	afterEach(() => {
		errorSpy.mockRestore();
		logSpy.mockRestore();
		exitSpy.mockRestore();
		if (originalAppId === undefined) {
			process.env.ASC_APP_ID = undefined;
		} else {
			process.env.ASC_APP_ID = originalAppId;
		}
	});

	test("--group lists subscriptions for that group", async () => {
		const getMock = mock(async (path: string) => {
			expect(path).toBe("/v1/subscriptionGroups/group1/subscriptions?limit=50");
			return { data: [{ id: "s1" }], links: { self: "x" } };
		});

		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => CREDS,
		}));
		mock.module("../../../api/client", () => ({
			Client: { fromCredentials: async () => ({ get: getMock }) },
		}));

		const { listSubscriptions } = await import("./index");

		await listSubscriptions({
			global: makeGlobal(),
			args: {
				command: ["subscriptions", "list"],
				options: { group: "group1" },
				positionals: [],
			},
		});

		expect(getMock).toHaveBeenCalledTimes(1);
	});

	test("--group and --app together is an error", async () => {
		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => CREDS,
		}));
		mock.module("../../../api/client", () => ({
			Client: { fromCredentials: async () => ({}) },
		}));

		const { listSubscriptions } = await import("./index");

		await expect(
			listSubscriptions({
				global: makeGlobal(),
				args: {
					command: ["subscriptions", "list"],
					options: { group: "group1", app: "app1" },
					positionals: [],
				},
			}),
		).rejects.toThrow("EXIT:1");

		expect(errorSpy.mock.calls[0]?.[0] as string).toContain(
			"mutually exclusive",
		);
	});

	test("neither --group nor --app (and no ASC_APP_ID) is an error", async () => {
		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => CREDS,
		}));
		mock.module("../../../api/client", () => ({
			Client: { fromCredentials: async () => ({}) },
		}));

		const { listSubscriptions } = await import("./index");

		await expect(
			listSubscriptions({
				global: makeGlobal(),
				args: {
					command: ["subscriptions", "list"],
					options: {},
					positionals: [],
				},
			}),
		).rejects.toThrow("EXIT:1");
	});

	test("--app fetches groups then merges subscriptions from each group", async () => {
		const getMock = mock(async (path: string) => {
			if (path.startsWith("/v1/apps/")) {
				expect(path).toBe("/v1/apps/app1/subscriptionGroups?limit=50");
				return {
					data: [{ id: "g1" }, { id: "g2" }],
					links: { self: "x" },
				};
			}
			if (path === "/v1/subscriptionGroups/g1/subscriptions?limit=50") {
				return { data: [{ id: "sub1" }], links: { self: "x" } };
			}
			if (path === "/v1/subscriptionGroups/g2/subscriptions?limit=50") {
				return { data: [{ id: "sub2" }], links: { self: "x" } };
			}
			throw new Error(`unexpected path: ${path}`);
		});

		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => CREDS,
		}));
		mock.module("../../../api/client", () => ({
			Client: { fromCredentials: async () => ({ get: getMock }) },
		}));

		const { listSubscriptions } = await import("./index");

		await listSubscriptions({
			global: makeGlobal(),
			args: {
				command: ["subscriptions", "list"],
				options: { app: "app1" },
				positionals: [],
			},
		});

		// 1 groups call + 2 per-group subscription calls
		expect(getMock).toHaveBeenCalledTimes(3);
	});

	test("respects ASC_APP_ID env fallback when --app is not given", async () => {
		process.env.ASC_APP_ID = "env-app";

		const getMock = mock(async (path: string) => {
			if (path.startsWith("/v1/apps/")) {
				expect(path).toBe("/v1/apps/env-app/subscriptionGroups?limit=50");
				return { data: [], links: { self: "x" } };
			}
			throw new Error(`unexpected path: ${path}`);
		});

		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => CREDS,
		}));
		mock.module("../../../api/client", () => ({
			Client: { fromCredentials: async () => ({ get: getMock }) },
		}));

		const { listSubscriptions } = await import("./index");

		await listSubscriptions({
			global: makeGlobal(),
			args: {
				command: ["subscriptions", "list"],
				options: {},
				positionals: [],
			},
		});

		expect(getMock).toHaveBeenCalledTimes(1);
	});

	test("passes filter[state] through when listing by --group", async () => {
		const getMock = mock(async (path: string) => {
			expect(path).toBe(
				"/v1/subscriptionGroups/group1/subscriptions?limit=50&filter%5Bstate%5D=APPROVED",
			);
			return { data: [], links: { self: "x" } };
		});

		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => CREDS,
		}));
		mock.module("../../../api/client", () => ({
			Client: { fromCredentials: async () => ({ get: getMock }) },
		}));

		const { listSubscriptions } = await import("./index");

		await listSubscriptions({
			global: makeGlobal(),
			args: {
				command: ["subscriptions", "list"],
				options: { group: "group1", state: "approved" },
				positionals: [],
			},
		});

		expect(getMock).toHaveBeenCalledTimes(1);
	});

	test("exits 1 for an invalid --state before making a request", async () => {
		const getMock = mock(async () => {
			throw new Error("should not be called");
		});

		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => CREDS,
		}));
		mock.module("../../../api/client", () => ({
			Client: { fromCredentials: async () => ({ get: getMock }) },
		}));

		const { listSubscriptions } = await import("./index");

		await expect(
			listSubscriptions({
				global: makeGlobal(),
				args: {
					command: ["subscriptions", "list"],
					options: { group: "group1", state: "BOGUS" },
					positionals: [],
				},
			}),
		).rejects.toThrow("EXIT:1");

		expect(getMock).not.toHaveBeenCalled();
	});
});
