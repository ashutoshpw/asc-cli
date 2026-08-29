import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	hasCredentials,
	requireCredentials,
	resolveCredentials,
} from "./credentials";

const environmentNames = [
	"ASC_CONFIG_PATH",
	"ASC_KEY_ID",
	"ASC_ISSUER_ID",
	"ASC_PRIVATE_KEY",
	"ASC_PRIVATE_KEY_PATH",
	"ASC_PRIVATE_KEY_B64",
];
const originalValues = new Map<string, string | undefined>();

describe("credential resolution", () => {
	beforeEach(() => {
		for (const name of environmentNames) {
			originalValues.set(name, process.env[name]);
			delete process.env[name];
		}
	});

	afterEach(() => {
		for (const name of environmentNames) {
			const value = originalValues.get(name);
			if (value === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = value;
			}
		}
		originalValues.clear();
	});

	test("resolves complete environment credentials when config is unavailable", async () => {
		process.env.ASC_CONFIG_PATH = "/tmp/asc-test-config-that-does-not-exist";
		process.env.ASC_KEY_ID = "KEY_ENV";
		process.env.ASC_ISSUER_ID = "ISSUER_ENV";
		process.env.ASC_PRIVATE_KEY = "PRIVATE_KEY_ENV";

		const credentials = await resolveCredentials({ bypassKeychain: true });

		expect(credentials).toMatchObject({
			keyId: "KEY_ENV",
			issuerId: "ISSUER_ENV",
			privateKey: "PRIVATE_KEY_ENV",
			source: "env",
		});
		if (!credentials) {
			throw new Error("Expected environment credentials");
		}
		expect(await hasCredentials({ bypassKeychain: true })).toBe(true);
		expect(await requireCredentials({ bypassKeychain: true })).toEqual(
			credentials,
		);
	});

	test("returns null and throws a useful error when no credentials exist", async () => {
		process.env.ASC_CONFIG_PATH = "/tmp/asc-test-config-that-does-not-exist";

		expect(await resolveCredentials({ bypassKeychain: true })).toBeNull();
		expect(await hasCredentials({ bypassKeychain: true })).toBe(false);
		await expect(requireCredentials({ bypassKeychain: true })).rejects.toThrow(
			"No credentials found",
		);
	});
});
