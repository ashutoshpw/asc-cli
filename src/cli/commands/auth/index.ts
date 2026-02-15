import { stat } from "node:fs/promises";
import {
	type StoredCredential,
	listCredentials,
	loadConfig,
	removeCredential,
	upsertCredential,
} from "../../../auth/config";
import { hasCredentials, resolveCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printInfo,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Auth commands
 * asc auth add/list/remove/switch/status
 */
import { type Command, type CommandContext, registry } from "../../router";

const authCommand: Command = {
	name: "auth",
	description: "Manage API credentials",
	subcommands: {
		add: {
			name: "add",
			description: "Add new API credentials (interactive by default)",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Name for this credential profile",
				},
				"key-id": {
					type: "string",
					short: "k",
					description: "API Key ID",
				},
				"issuer-id": {
					type: "string",
					short: "i",
					description: "Issuer ID",
				},
				"private-key-path": {
					type: "string",
					short: "p",
					description: "Path to private key (.p8 file)",
				},
				vendor: {
					type: "string",
					description: "Vendor number for sales/financial reports",
				},
				default: {
					type: "boolean",
					short: "d",
					description: "Set as default profile",
					default: false,
				},
			},
			execute: addCredential,
		},
		edit: {
			name: "edit",
			description: "Edit an existing credential profile",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Name of credential to edit",
					required: true,
				},
				"key-id": {
					type: "string",
					short: "k",
					description: "New API Key ID",
				},
				"issuer-id": {
					type: "string",
					short: "i",
					description: "New Issuer ID",
				},
				"private-key-path": {
					type: "string",
					short: "p",
					description: "New path to private key (.p8 file)",
				},
				vendor: {
					type: "string",
					description: "Vendor number for sales/financial reports",
				},
			},
			execute: editCredential,
		},
		list: {
			name: "list",
			description: "List stored credentials",
			execute: listCredentialsCommand,
		},
		remove: {
			name: "remove",
			description: "Remove a credential",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Name of credential to remove",
					required: true,
				},
			},
			execute: removeCredentialCommand,
		},
		switch: {
			name: "switch",
			description: "Switch default credential",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Name of credential to set as default",
					required: true,
				},
			},
			execute: switchCredential,
		},
		status: {
			name: "status",
			description: "Show current authentication status",
			execute: showStatus,
		},
	},
};

async function addCredential(ctx: CommandContext): Promise<void> {
	const { options } = ctx.args;

	const keyId = options["key-id"] as string | undefined;
	const issuerId = options["issuer-id"] as string | undefined;
	const privateKeyPath = options["private-key-path"] as string | undefined;
	const vendorNumber = options.vendor as string | undefined;

	// If no credential flags provided, run interactive mode
	if (!keyId && !issuerId && !privateKeyPath) {
		return addCredentialInteractive(ctx);
	}

	// Non-interactive (scripted) mode - all credential fields required
	if (!keyId) {
		printError(
			"--key-id is required (or run without flags for interactive mode)",
		);
		process.exit(1);
	}
	if (!issuerId) {
		printError(
			"--issuer-id is required (or run without flags for interactive mode)",
		);
		process.exit(1);
	}
	if (!privateKeyPath) {
		printError(
			"--private-key-path is required (or run without flags for interactive mode)",
		);
		process.exit(1);
	}

	const name = (options.name as string) || "default";
	const isDefault = options.default === true;

	// Validate private key path exists
	try {
		await stat(privateKeyPath);
	} catch {
		printError(`Private key file not found: ${privateKeyPath}`);
		process.exit(1);
	}

	const cred: StoredCredential = {
		name,
		key_id: keyId,
		issuer_id: issuerId,
		private_key_path: privateKeyPath,
		is_default: isDefault,
		vendor_number: vendorNumber,
	};

	await upsertCredential(cred);
	printSuccess(`Credential "${name}" added successfully`);

	if (isDefault) {
		printInfo("Set as default profile");
	}
	if (vendorNumber) {
		printInfo(`Vendor number: ${vendorNumber}`);
	}
}

async function listCredentialsCommand(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const creds = await listCredentials();

	if (creds.length === 0) {
		printInfo("No credentials stored. Use 'asc auth add' to add credentials.");
		return;
	}

	// Get current default from config
	const config = await loadConfig();
	const defaultName = config?.default_key_name;

	// Format for display
	// Only use config.default_key_name as the source of truth for which profile is default
	const displayCreds = creds.map((c) => ({
		name: c.name,
		keyId: c.key_id,
		issuerId: `${c.issuer_id.slice(0, 8)}...`,
		keyPath: c.private_key_path || "(inline)",
		vendorNumber: c.vendor_number || "",
		default: c.name === defaultName ? "yes" : "",
	}));

	printOutput(displayCreds, format);
}

async function editCredential(ctx: CommandContext): Promise<void> {
	const { options } = ctx.args;
	const name = options.name as string;

	if (!name) {
		printError("--name is required");
		process.exit(1);
	}

	// Load existing config and find credential
	const config = await loadConfig();
	if (!config) {
		printError("No config file found");
		process.exit(1);
	}

	const existingCred = config.keys?.find((k) => k.name === name);
	if (!existingCred) {
		printError(`Credential "${name}" not found`);
		process.exit(1);
	}

	// Check if any flags provided for non-interactive mode
	const keyId = options["key-id"] as string | undefined;
	const issuerId = options["issuer-id"] as string | undefined;
	const privateKeyPath = options["private-key-path"] as string | undefined;
	const vendorNumber = options.vendor as string | undefined;

	// If no flags provided, run interactive mode
	if (!keyId && !issuerId && !privateKeyPath && !vendorNumber) {
		return editCredentialInteractive(existingCred);
	}

	// Non-interactive mode - update only provided fields
	const updatedCred: StoredCredential = {
		...existingCred,
		key_id: keyId || existingCred.key_id,
		issuer_id: issuerId || existingCred.issuer_id,
		private_key_path: privateKeyPath || existingCred.private_key_path,
		vendor_number: vendorNumber || existingCred.vendor_number,
	};

	// Validate private key path if provided
	if (privateKeyPath) {
		try {
			await stat(privateKeyPath);
		} catch {
			printError(`Private key file not found: ${privateKeyPath}`);
			process.exit(1);
		}
	}

	await upsertCredential(updatedCred);
	printSuccess(`Credential "${name}" updated successfully`);

	if (keyId) printInfo(`Key ID: ${keyId}`);
	if (issuerId) printInfo(`Issuer ID: ${issuerId.slice(0, 8)}...`);
	if (privateKeyPath) printInfo(`Private key path: ${privateKeyPath}`);
	if (vendorNumber) printInfo(`Vendor number: ${vendorNumber}`);
}

async function editCredentialInteractive(existingCred: StoredCredential): Promise<void> {
	console.log(`\n  Editing credential profile: ${existingCred.name}\n`);
	console.log("  Press Enter to keep current value, or type new value to update.\n");

	// Key ID
	console.log(`  Current Key ID: ${existingCred.key_id}`);
	const keyIdInput = prompt("  New Key ID (Enter to keep): ");
	const keyId = keyIdInput?.trim() || existingCred.key_id;

	// Issuer ID
	console.log(`  Current Issuer ID: ${existingCred.issuer_id}`);
	const issuerIdInput = prompt("  New Issuer ID (Enter to keep): ");
	const issuerId = issuerIdInput?.trim() || existingCred.issuer_id;

	// Private key path
	console.log(`  Current Private key path: ${existingCred.private_key_path || "(not set)"}`);
	let privateKeyPath = existingCred.private_key_path;
	const pathInput = prompt("  New Private key path (Enter to keep): ");
	if (pathInput?.trim()) {
		const trimmedPath = pathInput.trim();
		const expandedPath = trimmedPath.startsWith("~")
			? trimmedPath.replace("~", process.env.HOME || "")
			: trimmedPath;

		try {
			await stat(expandedPath);
			privateKeyPath = expandedPath;
		} catch {
			console.log(`  Error: File not found: ${expandedPath}. Keeping current value.`);
		}
	}

	// Vendor number
	console.log(`\n  Current Vendor number: ${existingCred.vendor_number || "(not set)"}`);
	if (!existingCred.vendor_number) {
		console.log("  To find your vendor number:");
		console.log("    1. Go to https://appstoreconnect.apple.com/");
		console.log("    2. Navigate to 'Sales and Trends' or 'Payments and Financial Reports'");
		console.log("    3. Your vendor number is displayed at the top (usually 8 digits)");
	}
	const vendorInput = prompt("  New Vendor number (Enter to keep, 'clear' to remove): ");
	let vendorNumber = existingCred.vendor_number;
	if (vendorInput?.trim()) {
		if (vendorInput.trim().toLowerCase() === "clear") {
			vendorNumber = undefined;
		} else {
			vendorNumber = vendorInput.trim();
		}
	}

	// Save updated credential
	const updatedCred: StoredCredential = {
		...existingCred,
		key_id: keyId,
		issuer_id: issuerId,
		private_key_path: privateKeyPath,
		vendor_number: vendorNumber,
	};

	await upsertCredential(updatedCred);

	console.log("");
	printSuccess(`Credential "${existingCred.name}" updated successfully`);
}

async function removeCredentialCommand(ctx: CommandContext): Promise<void> {
	const name = ctx.args.options.name as string;

	if (!name) {
		printError("--name is required");
		process.exit(1);
	}

	const removed = await removeCredential(name);

	if (removed) {
		printSuccess(`Credential "${name}" removed`);
	} else {
		printError(`Credential "${name}" not found`);
		process.exit(1);
	}
}

async function switchCredential(ctx: CommandContext): Promise<void> {
	const name = ctx.args.options.name as string;

	if (!name) {
		printError("--name is required");
		process.exit(1);
	}

	const config = await loadConfig();
	if (!config) {
		printError("No config file found");
		process.exit(1);
	}

	const cred = config.keys?.find((k) => k.name === name);
	if (!cred) {
		printError(`Credential "${name}" not found`);
		process.exit(1);
	}

	// Update with is_default
	await upsertCredential({ ...cred, is_default: true });
	printSuccess(`Switched default to "${name}"`);
}

async function showStatus(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);

	const creds = await resolveCredentials({
		profile: ctx.global.profile,
	});

	if (!creds) {
		printInfo("Not authenticated");
		printInfo("Run 'asc auth add --help' for setup instructions");
		return;
	}

	const status: Record<string, string | boolean> = {
		authenticated: true,
		source: creds.source,
		keyId: creds.keyId,
		issuerId: `${creds.issuerId.slice(0, 8)}...`,
		profile: creds.name || "(unnamed)",
		keyPath: creds.privateKeyPath || "(inline/env)",
	};

	if (creds.vendorNumber) {
		status.vendorNumber = creds.vendorNumber;
	}

	printOutput(status, format);
}

async function addCredentialInteractive(_ctx: CommandContext): Promise<void> {
	console.log("\n  App Store Connect API Credentials Setup\n");
	console.log(
		"  Generate API keys at: https://appstoreconnect.apple.com/access/integrations/api\n",
	);

	// Profile name
	const nameInput = prompt("  Profile name (default): ");
	const name = nameInput?.trim() || "default";

	// Issuer ID
	let issuerId = "";
	while (!issuerId) {
		const issuerInput = prompt("  Issuer ID: ");
		if (issuerInput?.trim()) {
			issuerId = issuerInput.trim();
		} else {
			console.log("  Error: Issuer ID is required");
		}
	}

	// Key ID
	let keyId = "";
	while (!keyId) {
		const keyInput = prompt("  Key ID: ");
		if (keyInput?.trim()) {
			keyId = keyInput.trim();
		} else {
			console.log("  Error: Key ID is required");
		}
	}

	// Private key path
	let privateKeyPath = "";
	while (!privateKeyPath) {
		const pathInput = prompt("  Private key path (.p8 file): ");
		if (pathInput?.trim()) {
			const trimmedPath = pathInput.trim();
			// Expand ~ to home directory
			const expandedPath = trimmedPath.startsWith("~")
				? trimmedPath.replace("~", process.env.HOME || "")
				: trimmedPath;

			try {
				await stat(expandedPath);
				privateKeyPath = expandedPath;
			} catch {
				console.log(`  Error: File not found: ${expandedPath}`);
			}
		} else {
			console.log("  Error: Private key path is required");
		}
	}

	// Vendor number (optional)
	console.log("\n  Vendor Number (optional - required for sales/financial reports)");
	console.log("  To find your vendor number:");
	console.log("    1. Go to https://appstoreconnect.apple.com/");
	console.log("    2. Navigate to 'Sales and Trends' or 'Payments and Financial Reports'");
	console.log("    3. Your vendor number is displayed at the top (usually 8 digits)");
	console.log("  You can also add this later with: asc auth edit -n <profile> -v <vendor>\n");

	const vendorInput = prompt("  Vendor number (press Enter to skip): ");
	const vendorNumber = vendorInput?.trim() || undefined;

	// Set as default?
	const existingCreds = await listCredentials();
	let isDefault = existingCreds.length === 0; // Default to true if no existing credentials

	if (existingCreds.length > 0) {
		const defaultInput = prompt("  Set as default profile? (y/N): ");
		isDefault =
			defaultInput?.toLowerCase() === "y" ||
			defaultInput?.toLowerCase() === "yes";
	}

	// Save credential
	const cred: StoredCredential = {
		name,
		key_id: keyId,
		issuer_id: issuerId,
		private_key_path: privateKeyPath,
		is_default: isDefault,
		vendor_number: vendorNumber,
	};

	await upsertCredential(cred);

	console.log("");
	printSuccess(`Credential "${name}" added successfully`);

	if (isDefault) {
		printInfo("Set as default profile");
	}
	if (vendorNumber) {
		printInfo(`Vendor number: ${vendorNumber}`);
	}

	console.log("\n  You can now use the CLI. Try: asc apps list\n");
}

export function registerAuthCommands(): void {
	registry.register(authCommand);
}
