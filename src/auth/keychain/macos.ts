/**
 * macOS Keychain integration using the security command-line tool
 *
 * Uses the `security` CLI instead of FFI for simplicity and reliability.
 * The security command is available on all macOS versions.
 */

const SERVICE_NAME = "asc";
const ITEM_PREFIX = "asc:credential:";

interface KeychainItem {
	name: string;
	keyId: string;
	issuerId: string;
	privateKeyPath: string;
}

/**
 * Check if keychain is available (macOS only)
 */
export function isKeychainAvailable(): boolean {
	return process.platform === "darwin";
}

/**
 * Store a credential in the keychain
 */
export async function storeInKeychain(item: KeychainItem): Promise<void> {
	if (!isKeychainAvailable()) {
		throw new Error("Keychain is only available on macOS");
	}

	const account = `${ITEM_PREFIX}${item.name}`;
	const password = JSON.stringify({
		key_id: item.keyId,
		issuer_id: item.issuerId,
		private_key_path: item.privateKeyPath,
	});

	// Delete existing item first (ignore errors if it doesn't exist)
	await runSecurityCommand([
		"delete-generic-password",
		"-s",
		SERVICE_NAME,
		"-a",
		account,
	]).catch(() => {});

	// Add new item
	const result = await runSecurityCommand([
		"add-generic-password",
		"-s",
		SERVICE_NAME,
		"-a",
		account,
		"-w",
		password,
		"-l",
		`ASC API Key (${item.name})`,
		"-U", // Update if exists
	]);

	if (!result.success) {
		throw new Error(`Failed to store credential in keychain: ${result.stderr}`);
	}
}

/**
 * Get a credential from the keychain by name
 */
export async function getFromKeychain(
	name: string,
): Promise<KeychainItem | null> {
	if (!isKeychainAvailable()) {
		return null;
	}

	const account = `${ITEM_PREFIX}${name}`;

	const result = await runSecurityCommand([
		"find-generic-password",
		"-s",
		SERVICE_NAME,
		"-a",
		account,
		"-w", // Output password only
	]);

	if (!result.success) {
		// Item not found or other error
		return null;
	}

	try {
		const data = JSON.parse(result.stdout.trim());
		return {
			name,
			keyId: data.key_id,
			issuerId: data.issuer_id,
			privateKeyPath: data.private_key_path,
		};
	} catch {
		// Invalid JSON in keychain item
		return null;
	}
}

/**
 * List all credentials from the keychain
 */
export async function listFromKeychain(): Promise<KeychainItem[]> {
	if (!isKeychainAvailable()) {
		return [];
	}

	// Use dump-keychain to list all items, then filter
	// This is a bit hacky but the security command doesn't have a good list API
	const result = await runSecurityCommand(["dump-keychain"]);

	if (!result.success) {
		return [];
	}

	// Parse the dump output to find our items
	const items: KeychainItem[] = [];
	const lines = result.stdout.split("\n");

	let currentAccount: string | null = null;
	let isGenericPassword = false;
	let isOurService = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith("class:")) {
			isGenericPassword = trimmed.includes('"genp"');
			isOurService = false;
			currentAccount = null;
		}

		if (trimmed.startsWith('"svce"') || trimmed.startsWith("0x00000007")) {
			isOurService = trimmed.includes(`"${SERVICE_NAME}"`);
		}

		if (trimmed.startsWith('"acct"')) {
			const match = trimmed.match(/"acct"[^"]*"([^"]+)"/);
			if (match) {
				currentAccount = match[1];
			}
		}

		// End of item
		if (
			trimmed === "" &&
			isGenericPassword &&
			isOurService &&
			currentAccount?.startsWith(ITEM_PREFIX)
		) {
			const name = currentAccount.slice(ITEM_PREFIX.length);
			const item = await getFromKeychain(name);
			if (item) {
				items.push(item);
			}
			currentAccount = null;
			isGenericPassword = false;
			isOurService = false;
		}
	}

	return items;
}

/**
 * Remove a credential from the keychain
 */
export async function removeFromKeychain(name: string): Promise<boolean> {
	if (!isKeychainAvailable()) {
		return false;
	}

	const account = `${ITEM_PREFIX}${name}`;

	const result = await runSecurityCommand([
		"delete-generic-password",
		"-s",
		SERVICE_NAME,
		"-a",
		account,
	]);

	return result.success;
}

/**
 * Run a security command and return the result
 */
async function runSecurityCommand(
	args: string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
	const proc = Bun.spawn(["security", ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);

	const exitCode = await proc.exited;

	return {
		success: exitCode === 0,
		stdout,
		stderr,
	};
}
