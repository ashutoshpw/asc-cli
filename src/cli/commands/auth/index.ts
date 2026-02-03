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
				default: {
					type: "boolean",
					short: "d",
					description: "Set as default profile",
					default: false,
				},
			},
			execute: addCredential,
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
	};

	await upsertCredential(cred);
	printSuccess(`Credential "${name}" added successfully`);

	if (isDefault) {
		printInfo("Set as default profile");
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
	const displayCreds = creds.map((c) => ({
		name: c.name,
		keyId: c.key_id,
		issuerId: `${c.issuer_id.slice(0, 8)}...`,
		keyPath: c.private_key_path || "(inline)",
		default: c.name === defaultName || c.is_default ? "yes" : "",
	}));

	printOutput(displayCreds, format);
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

	const status = {
		authenticated: true,
		source: creds.source,
		keyId: creds.keyId,
		issuerId: `${creds.issuerId.slice(0, 8)}...`,
		profile: creds.name || "(unnamed)",
		keyPath: creds.privateKeyPath || "(inline/env)",
	};

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
	};

	await upsertCredential(cred);

	console.log("");
	printSuccess(`Credential "${name}" added successfully`);

	if (isDefault) {
		printInfo("Set as default profile");
	}

	console.log("\n  You can now use the CLI. Try: asc apps list\n");
}

export function registerAuthCommands(): void {
	registry.register(authCommand);
}
