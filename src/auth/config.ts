/**
 * Configuration file management
 * Loads config from ~/.asc/config.json or local .asc/config.json
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface StoredCredential {
	name: string;
	key_id: string;
	issuer_id: string;
	private_key_path?: string;
	is_default?: boolean;
}

export interface ConfigFile {
	// Legacy single credential format
	key_id?: string;
	issuer_id?: string;
	private_key_path?: string;

	// Multi-credential format
	default_key_name?: string;
	keys?: StoredCredential[];

	// Default values
	app_id?: string;
	vendor_number?: string;

	// Settings
	timeout?: string;
	upload_timeout?: string;
	max_retries?: string;
	base_delay?: string;
	max_delay?: string;
}

/**
 * Get the global config directory path
 */
export function getGlobalConfigDir(): string {
	return join(homedir(), ".asc");
}

/**
 * Get the global config file path
 */
export function getGlobalConfigPath(): string {
	return join(getGlobalConfigDir(), "config.json");
}

/**
 * Find local config by walking up directories
 */
async function findLocalConfig(startDir: string): Promise<string | null> {
	let currentDir = startDir;
	const root = dirname(currentDir);

	while (currentDir !== root) {
		const configPath = join(currentDir, ".asc", "config.json");
		try {
			await stat(configPath);
			return configPath;
		} catch {
			// Not found, keep searching
		}

		// Check for git root to stop searching
		const gitPath = join(currentDir, ".git");
		try {
			await stat(gitPath);
			// Found git root, stop searching
			break;
		} catch {
			// Not git root, continue
		}

		currentDir = dirname(currentDir);
	}

	return null;
}

/**
 * Load config file from path
 */
async function loadConfigFile(path: string): Promise<ConfigFile | null> {
	try {
		const content = await readFile(path, "utf-8");
		return JSON.parse(content) as ConfigFile;
	} catch {
		return null;
	}
}

/**
 * Get the config file path to use (respects ASC_CONFIG_PATH env var)
 */
export async function getConfigPath(): Promise<string | null> {
	// Check env var first
	const envPath = Bun.env.ASC_CONFIG_PATH;
	if (envPath) {
		try {
			await stat(envPath);
			return envPath;
		} catch {
			return null;
		}
	}

	// Check for local config
	const localConfig = await findLocalConfig(process.cwd());
	if (localConfig) {
		return localConfig;
	}

	// Fall back to global config
	const globalPath = getGlobalConfigPath();
	try {
		await stat(globalPath);
		return globalPath;
	} catch {
		return null;
	}
}

/**
 * Load the configuration file
 */
export async function loadConfig(): Promise<ConfigFile | null> {
	const path = await getConfigPath();
	if (!path) {
		return null;
	}
	return loadConfigFile(path);
}

/**
 * Save configuration to global config file
 */
export async function saveConfig(config: ConfigFile): Promise<void> {
	const dir = getGlobalConfigDir();

	// Ensure directory exists
	try {
		await mkdir(dir, { recursive: true });
	} catch {
		// Directory might already exist
	}

	const path = getGlobalConfigPath();
	await writeFile(path, JSON.stringify(config, null, 2));
}

/**
 * Get a credential from config by name
 */
export function getCredentialFromConfig(
	config: ConfigFile,
	name?: string,
): StoredCredential | null {
	// If name is specified, find it
	if (name) {
		const cred = config.keys?.find((k) => k.name === name);
		return cred || null;
	}

	// Try to find default
	if (config.default_key_name) {
		const cred = config.keys?.find((k) => k.name === config.default_key_name);
		if (cred) return cred;
	}

	// Try to find one marked as default
	const defaultCred = config.keys?.find((k) => k.is_default);
	if (defaultCred) return defaultCred;

	// Return first credential if exists
	if (config.keys && config.keys.length > 0) {
		return config.keys[0];
	}

	// Fall back to legacy single credential
	if (config.key_id && config.issuer_id) {
		return {
			name: "default",
			key_id: config.key_id,
			issuer_id: config.issuer_id,
			private_key_path: config.private_key_path,
			is_default: true,
		};
	}

	return null;
}

/**
 * Add or update a credential in config
 */
export async function upsertCredential(cred: StoredCredential): Promise<void> {
	let config = await loadConfig();
	if (!config) {
		config = { keys: [] };
	}

	if (!config.keys) {
		config.keys = [];
	}

	// Find existing
	const index = config.keys.findIndex((k) => k.name === cred.name);
	if (index >= 0) {
		config.keys[index] = cred;
	} else {
		config.keys.push(cred);
	}

	// If this is the first credential or marked as default, set as default
	if (cred.is_default || config.keys.length === 1) {
		config.default_key_name = cred.name;
	}

	await saveConfig(config);
}

/**
 * Remove a credential from config
 */
export async function removeCredential(name: string): Promise<boolean> {
	const config = await loadConfig();
	if (!config || !config.keys) {
		return false;
	}

	const index = config.keys.findIndex((k) => k.name === name);
	if (index < 0) {
		return false;
	}

	config.keys.splice(index, 1);

	// Update default if needed
	if (config.default_key_name === name) {
		config.default_key_name = config.keys[0]?.name;
	}

	await saveConfig(config);
	return true;
}

/**
 * List all credentials in config
 */
export async function listCredentials(): Promise<StoredCredential[]> {
	const config = await loadConfig();
	if (!config) {
		return [];
	}

	// Include legacy credential if present
	const creds: StoredCredential[] = [];

	if (config.keys) {
		creds.push(...config.keys);
	} else if (config.key_id && config.issuer_id) {
		creds.push({
			name: "default",
			key_id: config.key_id,
			issuer_id: config.issuer_id,
			private_key_path: config.private_key_path,
			is_default: true,
		});
	}

	return creds;
}
