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

describe("iap parseStateFilter", () => {
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

	test("returns undefined for empty string", async () => {
		const { parseStateFilter } = await import("./index");
		expect(parseStateFilter("")).toBeUndefined();
	});

	test("normalizes a single state to uppercase", async () => {
		const { parseStateFilter } = await import("./index");
		expect(parseStateFilter("approved")).toEqual(["APPROVED"]);
	});

	test("accepts comma-separated multiple states and normalizes case", async () => {
		const { parseStateFilter } = await import("./index");
		expect(parseStateFilter("approved, in_review,ReJeCtEd")).toEqual([
			"APPROVED",
			"IN_REVIEW",
			"REJECTED",
		]);
	});

	test("exits 1 and prints a helpful error for an invalid state", async () => {
		const { parseStateFilter } = await import("./index");
		expect(() => parseStateFilter("NOT_A_STATE")).toThrow("EXIT:1");
		expect(errorSpy).toHaveBeenCalledTimes(1);
		const message = errorSpy.mock.calls[0]?.[0] as string;
		expect(message).toContain("NOT_A_STATE");
		expect(message).toContain("APPROVED");
	});

	test("exits 1 when at least one state in a list is invalid", async () => {
		const { parseStateFilter } = await import("./index");
		expect(() => parseStateFilter("APPROVED,BOGUS")).toThrow("EXIT:1");
		expect(errorSpy.mock.calls[0]?.[0] as string).toContain("BOGUS");
	});
});

describe("iap list --state", () => {
	let exitSpy: ReturnType<typeof spyOn>;
	let errorSpy: ReturnType<typeof spyOn>;
	let logSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
		logSpy = spyOn(console, "log").mockImplementation(() => {});
		exitSpy = spyOn(process, "exit").mockImplementation(((code?: number) => {
			throw new Error(`EXIT:${code}`);
		}) as never);
	});

	afterEach(() => {
		errorSpy.mockRestore();
		logSpy.mockRestore();
		exitSpy.mockRestore();
	});

	test("passes filter[state] through to the API request", async () => {
		const getMock = mock(async (path: string) => {
			expect(path).toContain(
				"/v2/apps/app123/inAppPurchasesV2?limit=50&filter%5Bstate%5D=APPROVED%2CREJECTED",
			);
			return { data: [], links: { self: "x" } };
		});

		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => CREDS,
		}));
		mock.module("../../../api/client", () => ({
			Client: {
				fromCredentials: async () => ({ get: getMock }),
			},
		}));

		const { listIAPs } = await import("./index");

		await listIAPs({
			global: makeGlobal(),
			args: {
				command: ["iap", "list"],
				options: { app: "app123", state: "approved,rejected" },
				positionals: [],
			},
		});

		expect(getMock).toHaveBeenCalledTimes(1);
	});

	test("omits filter[state] when --state is not given", async () => {
		const getMock = mock(async (path: string) => {
			expect(path).not.toContain("filter%5Bstate%5D");
			return { data: [], links: { self: "x" } };
		});

		mock.module("../../../auth/credentials", () => ({
			requireCredentials: async () => CREDS,
		}));
		mock.module("../../../api/client", () => ({
			Client: {
				fromCredentials: async () => ({ get: getMock }),
			},
		}));

		const { listIAPs } = await import("./index");

		await listIAPs({
			global: makeGlobal(),
			args: {
				command: ["iap", "list"],
				options: { app: "app123" },
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
			Client: {
				fromCredentials: async () => ({ get: getMock }),
			},
		}));

		const { listIAPs } = await import("./index");

		await expect(
			listIAPs({
				global: makeGlobal(),
				args: {
					command: ["iap", "list"],
					options: { app: "app123", state: "BOGUS" },
					positionals: [],
				},
			}),
		).rejects.toThrow("EXIT:1");

		expect(getMock).not.toHaveBeenCalled();
	});
});
