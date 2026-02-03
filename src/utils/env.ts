/**
 * Environment variable handling utilities
 */

export interface EnvConfig {
	// Authentication
	keyId?: string;
	issuerId?: string;
	privateKeyPath?: string;
	privateKey?: string;
	privateKeyBase64?: string;

	// Defaults
	appId?: string;
	vendorNumber?: string;

	// Timeouts
	timeout?: number;
	uploadTimeout?: number;

	// Retry
	maxRetries?: number;
	baseDelay?: number;
	maxDelay?: number;

	// Behavior
	debug?: boolean;
	apiDebug?: boolean;
	retryLog?: boolean;
	noUpdate?: boolean;
	bypassKeychain?: boolean;
	strictAuth?: boolean;
}

/**
 * Parse duration string (e.g., "90s", "2m") to milliseconds
 */
function parseDuration(value: string | undefined): number | undefined {
	if (!value) return undefined;

	const match = value.match(/^(\d+)(s|m|ms)?$/);
	if (!match) return undefined;

	const num = Number.parseInt(match[1], 10);
	const unit = match[2] || "s";

	switch (unit) {
		case "ms":
			return num;
		case "s":
			return num * 1000;
		case "m":
			return num * 60 * 1000;
		default:
			return num * 1000;
	}
}

/**
 * Parse boolean environment variable
 */
function parseBool(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	const lower = value.toLowerCase();
	if (lower === "1" || lower === "true" || lower === "yes") return true;
	if (lower === "0" || lower === "false" || lower === "no" || lower === "")
		return false;
	return undefined;
}

/**
 * Load configuration from environment variables
 */
export function loadEnvConfig(): EnvConfig {
	const env = Bun.env;

	return {
		// Authentication
		keyId: env.ASC_KEY_ID,
		issuerId: env.ASC_ISSUER_ID,
		privateKeyPath: env.ASC_PRIVATE_KEY_PATH,
		privateKey: env.ASC_PRIVATE_KEY,
		privateKeyBase64: env.ASC_PRIVATE_KEY_B64,

		// Defaults
		appId: env.ASC_APP_ID,
		vendorNumber: env.ASC_VENDOR_NUMBER,

		// Timeouts
		timeout:
			parseDuration(env.ASC_TIMEOUT) ??
			(env.ASC_TIMEOUT_SECONDS
				? Number.parseInt(env.ASC_TIMEOUT_SECONDS, 10) * 1000
				: undefined),
		uploadTimeout:
			parseDuration(env.ASC_UPLOAD_TIMEOUT) ??
			(env.ASC_UPLOAD_TIMEOUT_SECONDS
				? Number.parseInt(env.ASC_UPLOAD_TIMEOUT_SECONDS, 10) * 1000
				: undefined),

		// Retry
		maxRetries: env.ASC_MAX_RETRIES
			? Number.parseInt(env.ASC_MAX_RETRIES, 10)
			: undefined,
		baseDelay: env.ASC_BASE_DELAY
			? Number.parseInt(env.ASC_BASE_DELAY, 10)
			: undefined,
		maxDelay: env.ASC_MAX_DELAY
			? Number.parseInt(env.ASC_MAX_DELAY, 10)
			: undefined,

		// Behavior
		debug: parseBool(env.ASC_DEBUG),
		apiDebug: env.ASC_DEBUG === "api",
		retryLog: parseBool(env.ASC_RETRY_LOG),
		noUpdate: parseBool(env.ASC_NO_UPDATE),
		bypassKeychain: parseBool(env.ASC_BYPASS_KEYCHAIN),
		strictAuth: parseBool(env.ASC_STRICT_AUTH),
	};
}

/**
 * Get a required environment variable or throw
 */
export function requireEnv(name: string): string {
	const value = Bun.env[name];
	if (!value) {
		throw new Error(`Required environment variable ${name} is not set`);
	}
	return value;
}
