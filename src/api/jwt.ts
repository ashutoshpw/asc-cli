import { readFile } from "node:fs/promises";
/**
 * JWT generation for App Store Connect API
 * Uses ES256 (ECDSA P-256) algorithm
 */
import { SignJWT, importPKCS8 } from "jose";

// Token lifetime: 20 minutes (same as Go implementation)
const TOKEN_LIFETIME_SECONDS = 20 * 60;

/**
 * Generate a JWT for App Store Connect API authentication
 */
export async function generateJWT(
	keyId: string,
	issuerId: string,
	privateKey: string,
): Promise<string> {
	// Import the private key
	const key = await importPKCS8(privateKey, "ES256");

	// Build and sign the JWT
	const jwt = await new SignJWT({})
		.setProtectedHeader({
			alg: "ES256",
			kid: keyId,
			typ: "JWT",
		})
		.setIssuer(issuerId)
		.setAudience("appstoreconnect-v1")
		.setIssuedAt()
		.setExpirationTime(`${TOKEN_LIFETIME_SECONDS}s`)
		.sign(key);

	return jwt;
}

/**
 * Load a private key from a file path
 */
export async function loadPrivateKey(path: string): Promise<string> {
	const content = await readFile(path, "utf-8");
	return content.trim();
}

/**
 * Load a private key from base64-encoded string
 */
export function decodePrivateKeyBase64(encoded: string): string {
	const decoded = Buffer.from(encoded, "base64").toString("utf-8");
	return decoded.trim();
}

/**
 * Validate that a private key is in PEM format
 */
export function isValidPrivateKey(key: string): boolean {
	return (
		key.includes("-----BEGIN PRIVATE KEY-----") ||
		key.includes("-----BEGIN EC PRIVATE KEY-----")
	);
}

/**
 * Simple JWT token cache to avoid regenerating tokens
 */
class TokenCache {
	private readonly tokens = new Map<
		string,
		{ token: string; expiresAt: number }
	>();

	// Regenerate token 60 seconds before expiry
	private readonly bufferMs = 60 * 1000;

	get(keyId: string, issuerId: string): string | null {
		const cacheKey = this.cacheKey(keyId, issuerId);
		const entry = this.tokens.get(cacheKey);

		if (entry && Date.now() < entry.expiresAt - this.bufferMs) {
			return entry.token;
		}

		if (entry) {
			this.tokens.delete(cacheKey);
		}

		return null;
	}

	set(keyId: string, issuerId: string, token: string): void {
		const cacheKey = this.cacheKey(keyId, issuerId);
		// Token is valid for 20 minutes
		this.tokens.set(cacheKey, {
			token,
			expiresAt: Date.now() + TOKEN_LIFETIME_SECONDS * 1000,
		});
	}

	clear(): void {
		this.tokens.clear();
	}

	private cacheKey(keyId: string, issuerId: string): string {
		return JSON.stringify([keyId, issuerId]);
	}
}

export const tokenCache = new TokenCache();
