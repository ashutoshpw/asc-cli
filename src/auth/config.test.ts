import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { loadEnvConfig, requireEnv } from "../utils/env";
import {
	type ConfigFile,
	getCredentialFromConfig,
	type StoredCredential,
} from "./config";

const firstCredential: StoredCredential = {
	name: "first",
	key_id: "KEY_FIRST",
	issuer_id: "ISSUER_FIRST",
};
const secondCredential: StoredCredential = {
	name: "second",
	key_id: "KEY_SECOND",
	issuer_id: "ISSUER_SECOND",
};

describe("credential config selection", () => {
	test("prefers a named credential, then configured default", () => {
		const config: ConfigFile = {
			default_key_name: "second",
			keys: [firstCredential, { ...secondCredential, is_default: true }],
		};

		expect(getCredentialFromConfig(config, "first")).toEqual(firstCredential);
		expect(getCredentialFromConfig(config)).toEqual({
			...secondCredential,
			is_default: true,
		});
	});

	test("falls back through marked, first, and legacy credentials", () => {
		expect(
			getCredentialFromConfig({
				keys: [{ ...firstCredential, is_default: true }],
			}),
		).toEqual({ ...firstCredential, is_default: true });
		expect(
			getCredentialFromConfig({ keys: [firstCredential, secondCredential] }),
		).toEqual(firstCredential);
		expect(
			getCredentialFromConfig({
				key_id: "LEGACY_KEY",
				issuer_id: "LEGACY_ISSUER",
				private_key_path: "/tmp/AuthKey.p8",
			}),
		).toMatchObject({
			name: "default",
			key_id: "LEGACY_KEY",
			is_default: true,
		});
		expect(getCredentialFromConfig({})).toBeNull();
	});
});

describe("environment configuration", () => {
	const names = [
		"ASC_KEY_ID",
		"ASC_ISSUER_ID",
		"ASC_PRIVATE_KEY_PATH",
		"ASC_TIMEOUT",
		"ASC_UPLOAD_TIMEOUT_SECONDS",
		"ASC_MAX_RETRIES",
		"ASC_DEBUG",
		"ASC_BYPASS_KEYCHAIN",
		"ASC_STRICT_AUTH",
	];
	const originalValues = new Map<string, string | undefined>();

	beforeEach(() => {
		for (const name of names) {
			originalValues.set(name, process.env[name]);
			delete process.env[name];
		}
	});

	afterEach(() => {
		for (const name of names) {
			const value = originalValues.get(name);
			if (value === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = value;
			}
		}
		originalValues.clear();
	});

	test("parses durations, retry settings, and booleans", () => {
		process.env.ASC_KEY_ID = "KEY";
		process.env.ASC_ISSUER_ID = "ISSUER";
		process.env.ASC_PRIVATE_KEY_PATH = "/tmp/AuthKey.p8";
		process.env.ASC_TIMEOUT = "2m";
		process.env.ASC_UPLOAD_TIMEOUT_SECONDS = "5";
		process.env.ASC_MAX_RETRIES = "4";
		process.env.ASC_DEBUG = "yes";
		process.env.ASC_BYPASS_KEYCHAIN = "1";
		process.env.ASC_STRICT_AUTH = "false";

		expect(loadEnvConfig()).toMatchObject({
			keyId: "KEY",
			issuerId: "ISSUER",
			privateKeyPath: "/tmp/AuthKey.p8",
			timeout: 120000,
			uploadTimeout: 5000,
			maxRetries: 4,
			debug: true,
			bypassKeychain: true,
			strictAuth: false,
		});
	});

	test("requires a non-empty environment variable", () => {
		process.env.ASC_KEY_ID = "KEY";
		expect(requireEnv("ASC_KEY_ID")).toBe("KEY");
		process.env.ASC_KEY_ID = "";
		expect(() => requireEnv("ASC_KEY_ID")).toThrow(
			"Required environment variable ASC_KEY_ID is not set",
		);
	});
});
