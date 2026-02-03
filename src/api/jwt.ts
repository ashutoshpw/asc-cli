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
	private token: string | null = null;
	private expiresAt = 0;

	// Regenerate token 60 seconds before expiry
	private readonly bufferMs = 60 * 1000;

	get(keyId: string, issuerId: string): string | null {
		// Check if we have a valid cached token
		if (this.token && Date.now() < this.expiresAt - this.bufferMs) {
			return this.token;
		}
		return null;
	}

	set(token: string): void {
		this.token = token;
		// Token is valid for 20 minutes
		this.expiresAt = Date.now() + TOKEN_LIFETIME_SECONDS * 1000;
	}

	clear(): void {
		this.token = null;
		this.expiresAt = 0;
	}
}

export const tokenCache = new TokenCache();
