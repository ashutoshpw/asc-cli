import { type EnvConfig, loadEnvConfig } from "../utils/env";
/**
 * Credential resolution
 * Priority: Keychain > Config file > Environment variables
 */
import {
	type StoredCredential,
	getCredentialFromConfig,
	loadConfig,
} from "./config";
import {
	getFromKeychain,
	isKeychainAvailable,
	listFromKeychain,
} from "./keychain/macos";

export interface ResolvedCredentials {
	keyId: string;
	issuerId: string;
	privateKeyPath?: string;
	privateKey?: string;
	privateKeyBase64?: string;
	source: "keychain" | "config" | "env";
	name?: string;
	vendorNumber?: string;
}

export interface CredentialResolutionOptions {
	profile?: string;
	bypassKeychain?: boolean;
	strictAuth?: boolean;
}

/**
 * Resolve credentials from all sources
 */
export async function resolveCredentials(
	options: CredentialResolutionOptions = {},
): Promise<ResolvedCredentials | null> {
	const sources: { source: string; creds: ResolvedCredentials | null }[] = [];

	// Try keychain first (if not bypassed)
	if (!options.bypassKeychain && process.platform === "darwin") {
		const keychainCreds = await resolveFromKeychain(options.profile);
		if (keychainCreds) {
			sources.push({ source: "keychain", creds: keychainCreds });
		}
	}

	// Try config file
	const configCreds = await resolveFromConfig(options.profile);
	if (configCreds) {
		sources.push({ source: "config", creds: configCreds });
	}

	// Try environment variables
	const envCreds = resolveFromEnv();
	if (envCreds) {
		sources.push({ source: "env", creds: envCreds });
	}

	// Check for strict auth mode
	if (options.strictAuth && sources.length > 1) {
		const sourceList = sources.map((s) => s.source).join(", ");
		throw new Error(
			`Credentials found from multiple sources: ${sourceList}. Use --profile to specify which to use, or set ASC_BYPASS_KEYCHAIN=1 to skip keychain.`,
		);
	}

	// Return first available
	return sources[0]?.creds || null;
}

/**
 * Resolve credentials from macOS Keychain
 */
async function resolveFromKeychain(
	profile?: string,
): Promise<ResolvedCredentials | null> {
	if (!isKeychainAvailable()) {
		return null;
	}

	// If a profile is specified, look for that specific credential
	if (profile) {
		const item = await getFromKeychain(profile);
		if (item) {
			return {
				keyId: item.keyId,
				issuerId: item.issuerId,
				privateKeyPath: item.privateKeyPath,
				source: "keychain",
				name: item.name,
			};
		}
		return null;
	}

	// Otherwise, get the first/default credential from keychain
	const items = await listFromKeychain();
	if (items.length === 0) {
		return null;
	}

	// Return the first item (TODO: implement default tracking)
	const item = items[0];
	return {
		keyId: item.keyId,
		issuerId: item.issuerId,
		privateKeyPath: item.privateKeyPath,
		source: "keychain",
		name: item.name,
	};
}

/**
 * Resolve credentials from config file
 */
async function resolveFromConfig(
	profile?: string,
): Promise<ResolvedCredentials | null> {
	const config = await loadConfig();
	if (!config) {
		return null;
	}

	const cred = getCredentialFromConfig(config, profile);
	if (!cred) {
		return null;
	}

	return {
		keyId: cred.key_id,
		issuerId: cred.issuer_id,
		privateKeyPath: cred.private_key_path,
		source: "config",
		name: cred.name,
		vendorNumber: cred.vendor_number,
	};
}

/**
 * Resolve credentials from environment variables
 */
function resolveFromEnv(): ResolvedCredentials | null {
	const env = loadEnvConfig();

	if (!env.keyId || !env.issuerId) {
		return null;
	}

	// Need at least one private key source
	if (!env.privateKeyPath && !env.privateKey && !env.privateKeyBase64) {
		return null;
	}

	return {
		keyId: env.keyId,
		issuerId: env.issuerId,
		privateKeyPath: env.privateKeyPath,
		privateKey: env.privateKey,
		privateKeyBase64: env.privateKeyBase64,
		source: "env",
		vendorNumber: env.vendorNumber,
	};
}

/**
 * Check if credentials are available from any source
 */
export async function hasCredentials(
	options: CredentialResolutionOptions = {},
): Promise<boolean> {
	const creds = await resolveCredentials(options);
	return creds !== null;
}

/**
 * Get credentials or throw if not available
 */
export async function requireCredentials(
	options: CredentialResolutionOptions = {},
): Promise<ResolvedCredentials> {
	const creds = await resolveCredentials(options);

	if (!creds) {
		throw new Error(
			"No credentials found. Set up authentication using one of:\n" +
				"  1. asc auth add --key-id KEY --issuer-id ISSUER --private-key-path /path/to/key.p8\n" +
				"  2. Environment variables: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY_PATH\n" +
				"  3. Config file at ~/.asc/config.json",
		);
	}

	return creds;
}
