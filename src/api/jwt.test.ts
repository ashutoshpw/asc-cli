import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	decodeJwt,
	decodeProtectedHeader,
	exportPKCS8,
	generateKeyPair,
} from "jose";
import {
	decodePrivateKeyBase64,
	generateJWT,
	isValidPrivateKey,
	loadPrivateKey,
	tokenCache,
} from "./jwt";

describe("JWT utilities", () => {
	beforeEach(() => {
		tokenCache.clear();
	});

	test("generates an ES256 token with App Store Connect claims", async () => {
		const { privateKey } = await generateKeyPair("ES256", {
			extractable: true,
		});
		const pem = await exportPKCS8(privateKey);
		const token = await generateJWT("KEY123", "ISSUER123", pem);
		const claims = decodeJwt(token);
		const header = decodeProtectedHeader(token);

		expect(header.alg).toBe("ES256");
		expect(header.kid).toBe("KEY123");
		expect(claims.iss).toBe("ISSUER123");
		expect(claims.aud).toBe("appstoreconnect-v1");
		expect(typeof claims.iat).toBe("number");
		expect(typeof claims.exp).toBe("number");
		expect((claims.exp as number) - (claims.iat as number)).toBe(1200);
	});

	test("validates and decodes PEM private keys", () => {
		const pem = "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----";
		const encoded = Buffer.from(pem).toString("base64");

		expect(isValidPrivateKey(pem)).toBe(true);
		expect(isValidPrivateKey("not a key")).toBe(false);
		expect(decodePrivateKeyBase64(encoded)).toBe(pem);
	});

	test("loads and trims a key from disk", async () => {
		const directory = await mkdtemp(join(tmpdir(), "asc-jwt-"));
		const path = join(directory, "AuthKey.p8");
		try {
			await writeFile(path, "  private-key\n", "utf8");
			expect(await loadPrivateKey(path)).toBe("private-key");
			expect(await readFile(path, "utf8")).toBe("  private-key\n");
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test("isolates cached tokens by key and issuer", () => {
		tokenCache.set("KEY_A", "ISSUER_A", "TOKEN_A");
		tokenCache.set("KEY_B", "ISSUER_B", "TOKEN_B");

		expect(tokenCache.get("KEY_A", "ISSUER_A")).toBe("TOKEN_A");
		expect(tokenCache.get("KEY_B", "ISSUER_B")).toBe("TOKEN_B");
		expect(tokenCache.get("KEY_A", "ISSUER_B")).toBeNull();
		tokenCache.clear();
		expect(tokenCache.get("KEY_A", "ISSUER_A")).toBeNull();
	});
});
